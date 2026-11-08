import { BN, Program } from "@anchor-lang/core";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { OneClickService } from "@defuse-protocol/one-click-sdk-typescript";
import { query } from "../../db/index";
import { decodeDepositEvents } from "../zkapi/depositEvent";
import {
  optimisticNullifierHash,
  revokeOptimisticCreditOnFailure,
} from "../defi/optimisticCreditEngine";
import {
  getRedis,
  invalidateRuntimeKeyCacheByHash,
} from "../x402/runtimeKeyMeter";

const FAST_FILL_FEE_BPS = 10; // 0.10% (BR-03)
const MERKLE_CACHE_KEY = "refract:merkle:tree";

export interface WorkerDeps {
  connection: Connection;
  program: Program;
  relayer: Keypair;
  usdcMint: PublicKey;
  depositorUsdc: PublicKey;
  getStatus?: (
    depositAddress: string,
  ) => Promise<{ status: string; amountOut?: string }>;
  limit?: number;
}

export interface PendingDeposit {
  id: string;
  aurora_quote_id: string;
  deposit_address: string;
  poseidon_commitment_hex: string;
  expected_solana_micro_usdc: string;
  status: string;
}

export interface WorkerResult {
  quoteId: string;
  status: "SETTLED" | "REVOKED" | "PENDING" | "ERROR";
  signature?: string;
  leafIndex?: number;
  root?: string;
  error?: string;
}

export async function fetchPendingDeposits(limit = 10): Promise<PendingDeposit[]> {
  // ponytail: single worker assumes no concurrent tick; add FOR UPDATE SKIP
  // LOCKED + a PROCESSING state if the worker is horizontally scaled.
  const res = await query<PendingDeposit>(
    `SELECT id, aurora_quote_id, deposit_address, poseidon_commitment_hex,
            expected_solana_micro_usdc::text, status
       FROM intent_deposits
      WHERE status IN ('QUOTE_CREATED','OPTIMISTIC_CREDITED','PENDING_DEPOSIT')
        AND deleted_at IS NULL
      ORDER BY created_at ASC
      LIMIT $1`,
    [limit],
  );
  return res.rows;
}

function defaultGetStatus(
  depositAddress: string,
): Promise<{ status: string; amountOut?: string }> {
  return OneClickService.getExecutionStatus(depositAddress).then((res) => ({
    status: String(res.status),
    amountOut: res.swapDetails?.amountOut,
  }));
}

function hexToBytes(hex: string): number[] {
  const raw = Buffer.from(hex.replace(/^0x/, ""), "hex");
  if (raw.length > 32) throw new Error("commitment exceeds 32 bytes");
  const out = Buffer.alloc(32);
  raw.copy(out, 32 - raw.length);
  return Array.from(out);
}


export async function processDeposit(
  deposit: PendingDeposit,
  deps: WorkerDeps,
): Promise<WorkerResult> {
  const getStatus = deps.getStatus ?? defaultGetStatus;
  let status: { status: string; amountOut?: string };
  try {
    status = await getStatus(deposit.deposit_address);
  } catch (err) {
    return {
      quoteId: deposit.aurora_quote_id,
      status: "ERROR",
      error: err instanceof Error ? err.message : String(err),
    };
  }

  if (status.status === "REFUNDED" || status.status === "FAILED") {
    await revokeOptimisticCreditOnFailure(
      deposit.aurora_quote_id,
      status.status === "REFUNDED" ? "REFUNDED" : "FAILED",
    );
    return { quoteId: deposit.aurora_quote_id, status: "REVOKED" };
  }

  if (status.status !== "SUCCESS") {
    return { quoteId: deposit.aurora_quote_id, status: "PENDING" };
  }

  const amount = BigInt(
    status.amountOut ?? deposit.expected_solana_micro_usdc,
  );
  if (amount <= 0n) {
    return {
      quoteId: deposit.aurora_quote_id,
      status: "ERROR",
      error: "Settled amount is zero",
    };
  }

  const programId = deps.program.programId;
  const [vaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("refract_vault"), deps.usdcMint.toBuffer()],
    programId,
  );
  const [liquidPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("liquid_vault"), vaultPda.toBuffer()],
    programId,
  );
  const [defiPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("defi_yield_vault"), vaultPda.toBuffer()],
    programId,
  );

  try {
    const signature = await deps.program.methods
      .depositAndCommit(hexToBytes(deposit.poseidon_commitment_hex), new BN(amount.toString()))
      .accounts({
        vault: vaultPda,
        liquidVault: liquidPda,
        usdcMint: deps.usdcMint,
        depositorUsdc: deps.depositorUsdc,
        depositor: deps.relayer.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    const tx = await deps.connection.getTransaction(signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });
    const event = decodeDepositEvents(tx?.meta?.logMessages ?? [])[0];

    if (event) {
      await query(
        `INSERT INTO merkle_leaves
           (leaf_index, commitment_hex, merkle_root_after_hex, solana_tx_sig)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (leaf_index) DO UPDATE
           SET commitment_hex = EXCLUDED.commitment_hex,
               merkle_root_after_hex = EXCLUDED.merkle_root_after_hex,
               solana_tx_sig = EXCLUDED.solana_tx_sig`,
        [event.leafIndex, event.commitment, event.newRoot, signature],
      );
    }

    await deps.program.methods
      .rebalanceDefiFloat()
      .accounts({
        vault: vaultPda,
        usdcMint: deps.usdcMint,
        liquidVault: liquidPda,
        defiYieldVault: defiPda,
        authority: deps.relayer.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    await upgradeOptimisticSession(
      deposit.aurora_quote_id,
      amount,
    );

    await query(
      `UPDATE intent_deposits
          SET status = 'SETTLED',
              solana_settlement_sig = $2,
              optimistic_credit_issued = TRUE,
              updated_at = now()
        WHERE aurora_quote_id = $1`,
      [deposit.aurora_quote_id, signature],
    );

    const redis = getRedis();
    if (redis) await redis.del(MERKLE_CACHE_KEY).catch(() => undefined);

    return {
      quoteId: deposit.aurora_quote_id,
      status: "SETTLED",
      signature,
      leafIndex: event?.leafIndex,
      root: event?.newRoot,
    };
  } catch (err) {
    return {
      quoteId: deposit.aurora_quote_id,
      status: "ERROR",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function upgradeOptimisticSession(
  auroraQuoteId: string,
  settledAmountMicroUsdc: bigint,
): Promise<void> {
  const fee = (settledAmountMicroUsdc * BigInt(FAST_FILL_FEE_BPS)) / 10_000n;
  const principal = settledAmountMicroUsdc - fee;
  if (principal <= 0n) return;

  const res = await query<{ runtime_key_hash: string }>(
    `UPDATE zk_runtime_sessions
        SET remaining_micro_usdc =
              remaining_micro_usdc + GREATEST($2::bigint - principal_micro_usdc, 0),
            principal_micro_usdc = $2::bigint,
            is_optimistic = FALSE,
            updated_at = now()
      WHERE nullifier_hash_hex = $1 AND is_optimistic = TRUE AND status = 'ACTIVE'
      RETURNING runtime_key_hash`,
    [optimisticNullifierHash(auroraQuoteId), principal.toString()],
  );
  for (const row of res.rows) {
    await invalidateRuntimeKeyCacheByHash(row.runtime_key_hash);
  }
}

/** Poll all pending deposits and settle/refund them. */
export async function processPendingDeposits(
  deps: WorkerDeps,
): Promise<WorkerResult[]> {
  const deposits = await fetchPendingDeposits(deps.limit ?? 10);
  const results: WorkerResult[] = [];
  for (const deposit of deposits) {
    results.push(await processDeposit(deposit, deps));
  }
  return results;
}
