import { createHash, randomBytes } from "node:crypto";
import { OneClickService } from "@defuse-protocol/one-click-sdk-typescript";
import { getPool } from "../../db/index";
import { hashRuntimeKey, invalidateRuntimeKeyCacheByHash } from "../x402/runtimeKeyMeter";

export const DEFAULT_OPTIMISTIC_CREDIT_MAX_MICRO_USDC = 5_000_000; // $5.00
export const SUBSIDY_BONUS_BPS = 840; // +8.4%
const LIQUID_RESERVE_UTILIZATION_BPS = 8_000; // 80% (BR-04)

export type OptimisticErrorCode =
  | "ERR_QUOTE_NOT_FOUND"
  | "ERR_OPTIMISTIC_ALREADY_ISSUED"
  | "ERR_LIQUID_RESERVE_BREAKER"
  | "ERR_INVALID_ORIGIN_TX";

export class OptimisticCreditError extends Error {
  readonly code: OptimisticErrorCode;
  readonly status: number;

  constructor(code: OptimisticErrorCode, message: string, status: number) {
    super(message);
    this.name = "OptimisticCreditError";
    this.code = code;
    this.status = status;
  }
}

export interface IssueOptimisticCreditParams {
  auroraQuoteId: string;
  originTxHash: string;
  groth16Proof?: unknown;
  publicInputs?: string[];
}

export interface OptimisticCreditResult {
  sessionId: string;
  runtimeKey: string;
  optimisticCreditMicroUsdc: number;
  yieldSubsidyBonusMicroUsdc: number;
  latencyMs: number;
}

/** Deterministic synthetic nullifier for an optimistic (not-yet-settled) note. */
export function optimisticNullifierHash(auroraQuoteId: string): string {
  return (
    "0x" +
    createHash("sha256")
      .update(`optimistic:${auroraQuoteId}`)
      .digest("hex")
  );
}

function maxOptimisticCredit(): number {
  const parsed = Number(
    process.env.OPTIMISTIC_CREDIT_MAX_MICRO_USDC ??
      DEFAULT_OPTIMISTIC_CREDIT_MAX_MICRO_USDC,
  );
  return Number.isInteger(parsed) && parsed > 0
    ? parsed
    : DEFAULT_OPTIMISTIC_CREDIT_MAX_MICRO_USDC;
}

function validateOriginTxHash(hash: string): void {
  const trimmed = hash.trim();
  if (trimmed.length < 10 || /\s/.test(trimmed)) {
    throw new OptimisticCreditError(
      "ERR_INVALID_ORIGIN_TX",
      "originTxHash must be a broadcast transaction hash from the origin chain.",
      400,
    );
  }
}

/**
 * Fire-and-forget notification so a slow 1Click roundtrip never adds latency.
 * Disabled by default; enable with AURORA_SUBMIT_DEPOSIT_TX=true.
 */
function notifyAuroraDepositTx(
  originTxHash: string,
  depositAddress: string,
): void {
  if (process.env.AURORA_SUBMIT_DEPOSIT_TX !== "true") return;
  void Promise.resolve()
    .then(() =>
      OneClickService.submitDepositTx({
        txHash: originTxHash,
        depositAddress,
      }),
    )
    .catch(() => undefined);
}

/** Issue up to $5.00 of instant credit from the Solana 10% liquid reserve. */
export async function issueOptimisticCredit(
  params: IssueOptimisticCreditParams,
): Promise<OptimisticCreditResult> {
  const started = performance.now();
  validateOriginTxHash(params.originTxHash);

  const cap = maxOptimisticCredit();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");

    const deposit = await client.query<{
      expected_solana_micro_usdc: string;
      status: string;
      optimistic_credit_issued: boolean;
      deposit_address: string;
    }>(
      `SELECT expected_solana_micro_usdc::text, status, optimistic_credit_issued, deposit_address
         FROM intent_deposits
        WHERE aurora_quote_id = $1 AND deleted_at IS NULL
        FOR UPDATE`,
      [params.auroraQuoteId],
    );

    const row = deposit.rows[0];
    if (!row) {
      throw new OptimisticCreditError(
        "ERR_QUOTE_NOT_FOUND",
        "Aurora quote was not found.",
        404,
      );
    }
    if (
      row.optimistic_credit_issued ||
      row.status === "OPTIMISTIC_CREDITED"
    ) {
      throw new OptimisticCreditError(
        "ERR_OPTIMISTIC_ALREADY_ISSUED",
        "Optimistic credit has already been issued for this quote.",
        409,
      );
    }
    if (!["QUOTE_CREATED", "PENDING_DEPOSIT"].includes(row.status)) {
      throw new OptimisticCreditError(
        "ERR_OPTIMISTIC_ALREADY_ISSUED",
        `Deposit is in state ${row.status} and cannot receive optimistic credit.`,
        409,
      );
    }

    const expected = Number(row.expected_solana_micro_usdc);
    const credit = Math.min(expected, cap);
    const bonus = Math.floor((credit * SUBSIDY_BONUS_BPS) / 10_000);

    const liquid = await client.query<{ liquid_reserve_micro_usdc: string }>(
      `SELECT liquid_reserve_micro_usdc::text
         FROM defi_vault_snapshots
        ORDER BY recorded_at DESC
        LIMIT 1`,
    );
    const liquidReserve = Number(
      liquid.rows[0]?.liquid_reserve_micro_usdc ?? DEFAULT_OPTIMISTIC_CREDIT_MAX_MICRO_USDC * 5,
    );
    const outstanding = await client.query<{ outstanding: string }>(
      `SELECT COALESCE(SUM(remaining_micro_usdc), 0)::text AS outstanding
         FROM zk_runtime_sessions
        WHERE is_optimistic = TRUE AND status = 'ACTIVE'`,
    );
    const utilized = Number(outstanding.rows[0].outstanding);
    if (
      utilized + credit >
      Math.floor((liquidReserve * LIQUID_RESERVE_UTILIZATION_BPS) / 10_000)
    ) {
      throw new OptimisticCreditError(
        "ERR_LIQUID_RESERVE_BREAKER",
        "Optimistic credit is paused: the 10% liquid reserve circuit breaker tripped. Falling back to standard Aurora settlement.",
        503,
      );
    }

    const lock = await client.query<{ deposit_address: string }>(
      `UPDATE intent_deposits
          SET status = 'OPTIMISTIC_CREDITED',
              optimistic_credit_issued = TRUE,
              optimistic_credit_micro_usdc = $2,
              origin_tx_hash = $3,
              updated_at = now()
        WHERE aurora_quote_id = $1
          AND optimistic_credit_issued = FALSE
          AND status IN ('QUOTE_CREATED','PENDING_DEPOSIT')
        RETURNING deposit_address`,
      [params.auroraQuoteId, credit, params.originTxHash],
    );
    if (lock.rowCount === 0) {
      throw new OptimisticCreditError(
        "ERR_OPTIMISTIC_ALREADY_ISSUED",
        "Optimistic credit has already been issued for this quote.",
        409,
      );
    }

    const runtimeKey = `rk_live_opt_${randomBytes(32).toString("hex")}`;
    const runtimeKeyHash = hashRuntimeKey(runtimeKey);
    const nullifierHash = optimisticNullifierHash(params.auroraQuoteId);

    const root = await client.query<{ merkle_root_after_hex: string }>(
      `SELECT merkle_root_after_hex FROM merkle_leaves ORDER BY leaf_index DESC LIMIT 1`,
    );
    const merkleRootUsed =
      root.rows[0]?.merkle_root_after_hex ?? "0x" + "00".repeat(32);

    const session = await client.query<{ id: string }>(
      `INSERT INTO zk_runtime_sessions
         (nullifier_hash_hex, merkle_root_used_hex, runtime_key_hash,
          principal_micro_usdc, yield_subsidy_micro_usdc, remaining_micro_usdc,
          is_optimistic, status, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,TRUE,'ACTIVE', now() + interval '24 hours')
       RETURNING id`,
      [
        nullifierHash,
        merkleRootUsed,
        runtimeKeyHash,
        credit,
        bonus,
        credit + bonus,
      ],
    );

    await client.query("COMMIT");

    notifyAuroraDepositTx(params.originTxHash, lock.rows[0].deposit_address);

    return {
      sessionId: session.rows[0].id,
      runtimeKey,
      optimisticCreditMicroUsdc: credit,
      yieldSubsidyBonusMicroUsdc: bonus,
      latencyMs: Math.round(performance.now() - started),
    };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

/** Revoke optimistic credit when the origin swap fails or is refunded (SEC-02). */
export async function revokeOptimisticCreditOnFailure(
  auroraQuoteId: string,
  reason: "FAILED" | "REFUNDED" = "FAILED",
): Promise<{ revoked: boolean }> {
  const nullifierHash = optimisticNullifierHash(auroraQuoteId);
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const session = await client.query<{ runtime_key_hash: string }>(
      `UPDATE zk_runtime_sessions
          SET status = 'REVOKED', updated_at = now()
        WHERE nullifier_hash_hex = $1 AND status = 'ACTIVE'
        RETURNING runtime_key_hash`,
      [nullifierHash],
    );
    await client.query(
      `UPDATE intent_deposits
          SET status = $2, updated_at = now()
        WHERE aurora_quote_id = $1`,
      [auroraQuoteId, reason],
    );
    await client.query("COMMIT");

    for (const row of session.rows) {
      await invalidateRuntimeKeyCacheByHash(row.runtime_key_hash);
    }
    return { revoked: (session.rowCount ?? 0) > 0 };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}
