import { randomUUID } from "node:crypto";
import {
  OneClickService,
  QuoteRequest,
  type QuoteResponse,
} from "@defuse-protocol/one-click-sdk-typescript";
import { getPool, query } from "../../db/index";
import { hashRuntimeKey, invalidateRuntimeKeyCacheByHash } from "../x402/runtimeKeyMeter";
import {
  configureOneClickClient,
  DEFAULT_SOLANA_USDC_ASSET_ID,
} from "./oneClickService";

export const MIN_CROSS_CHAIN_REFUND_MICRO_USDC = 1_000_000;

export type RefundErrorCode =
  | "ERR_PAYMENT_SIGNATURE_REQUIRED"
  | "ERR_INVALID_RUNTIME_KEY"
  | "ERR_SESSION_ALREADY_CLOSED"
  | "ERR_SESSION_NOT_ACTIVE"
  | "ERR_REFUND_BELOW_MINIMUM"
  | "ERR_AURORA_REFUND_UNAVAILABLE";

export class RefundError extends Error {
  readonly code: RefundErrorCode;
  readonly status: number;

  constructor(code: RefundErrorCode, message: string, status: number) {
    super(message);
    this.name = "RefundError";
    this.code = code;
    this.status = status;
  }
}

export interface RefundParams {
  destinationChain: string;
  destinationAsset: string;
  recipientAddress: string;
}

export interface RefundResult {
  auroraRefundQuoteId: string;
  refundedMicroUsdc: number;
  status: "PROCESSING_REFUND";
}

export interface RefundDeps {
  quoteFn?: (request: QuoteRequest) => Promise<QuoteResponse>;
}

interface SessionRow {
  id: string;
  remaining_micro_usdc: string;
  yield_subsidy_micro_usdc: string;
  status: string;
}

/** Accept either a base64 x402 PAYMENT-SIGNATURE envelope or a raw rk_live token. */
export function extractRuntimeKeyToken(header: string | null): string {
  if (!header) {
    throw new RefundError(
      "ERR_PAYMENT_SIGNATURE_REQUIRED",
      "PAYMENT-SIGNATURE header is required to refund a session.",
      401,
    );
  }
  try {
    const decoded = JSON.parse(Buffer.from(header, "base64").toString("utf8"));
    if (typeof decoded?.token === "string" && decoded.token.length > 0) {
      return decoded.token;
    }
  } catch {
    // not a base64 JSON envelope; fall through to raw token
  }
  return header;
}

function solanaReceiver(): string {
  return (
    process.env.SOLANA_RECEIVER_PUBKEY ??
    process.env.SOLANA_DEPLOYER_PUBKEY ??
    ""
  );
}

export function buildRefundQuoteRequest(
  params: RefundParams,
  refundableMicroUsdc: number,
): QuoteRequest {
  const refundTo = solanaReceiver();
  if (!refundTo) {
    throw new RefundError(
      "ERR_AURORA_REFUND_UNAVAILABLE",
      "No Solana refund address is configured (SOLANA_RECEIVER_PUBKEY).",
      502,
    );
  }
  return {
    dry: false,
    swapType: QuoteRequest.swapType.EXACT_INPUT,
    slippageTolerance: 100,
    originAsset: DEFAULT_SOLANA_USDC_ASSET_ID,
    depositType: QuoteRequest.depositType.ORIGIN_CHAIN,
    destinationAsset: params.destinationAsset,
    amount: refundableMicroUsdc.toString(),
    refundTo,
    refundType: QuoteRequest.refundType.ORIGIN_CHAIN,
    recipient: params.recipientAddress,
    recipientType: QuoteRequest.recipientType.DESTINATION_CHAIN,
    deadline: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  };
}

/**
 * Atomically close an active runtime session and initiate a reverse Aurora
 * Intent refund to any supported destination chain (R-011).
 */
export async function refundRuntimeSession(
  rawToken: string,
  params: RefundParams,
  deps: RefundDeps = {},
): Promise<RefundResult> {
  const runtimeKeyHash = hashRuntimeKey(rawToken);
  const client = await getPool().connect();
  let sessionId = "";
  let refundable = 0;

  try {
    await client.query("BEGIN");
    const res = await client.query<SessionRow>(
      `SELECT id, remaining_micro_usdc::text, yield_subsidy_micro_usdc::text, status
         FROM zk_runtime_sessions
        WHERE runtime_key_hash = $1
        FOR UPDATE`,
      [runtimeKeyHash],
    );
    const session = res.rows[0];
    if (!session) {
      throw new RefundError(
        "ERR_INVALID_RUNTIME_KEY",
        "Unknown Runtime Key.",
        401,
      );
    }
    if (session.status === "CLOSED_REFUNDED") {
      throw new RefundError(
        "ERR_SESSION_ALREADY_CLOSED",
        "This Runtime Key session has already been refunded.",
        409,
      );
    }
    if (session.status !== "ACTIVE") {
      throw new RefundError(
        "ERR_SESSION_NOT_ACTIVE",
        `Session is ${session.status} and cannot be refunded.`,
        409,
      );
    }

    const locked = await client.query<SessionRow>(
      `UPDATE zk_runtime_sessions
          SET status = 'CLOSED_REFUNDED', updated_at = now()
        WHERE id = $1 AND status = 'ACTIVE' AND remaining_micro_usdc > 0
        RETURNING id, remaining_micro_usdc::text, yield_subsidy_micro_usdc::text, status`,
      [session.id],
    );
    if (locked.rowCount === 0) {
      throw new RefundError(
        "ERR_SESSION_NOT_ACTIVE",
        "Session has no refundable balance.",
        409,
      );
    }

    sessionId = locked.rows[0].id;
    refundable = Math.max(
      0,
      Number(locked.rows[0].remaining_micro_usdc) -
        Number(locked.rows[0].yield_subsidy_micro_usdc),
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }

  // Yield subsidies cannot be farmed via instant deposit/withdraw loops.
  if (
    refundable < MIN_CROSS_CHAIN_REFUND_MICRO_USDC &&
    params.destinationChain !== "solana"
  ) {
    await reopenSession(sessionId);
    throw new RefundError(
      "ERR_REFUND_BELOW_MINIMUM",
      "Unspent principal is below the $1.00 cross-chain solver minimum. Refund to Solana instead.",
      400,
    );
  }
  if (refundable <= 0) {
    await reopenSession(sessionId);
    throw new RefundError(
      "ERR_SESSION_NOT_ACTIVE",
      "Session has no refundable principal after removing the yield subsidy.",
      409,
    );
  }

  await invalidateRuntimeKeyCacheByHash(runtimeKeyHash);

  const quoteFn =
    deps.quoteFn ?? ((req: QuoteRequest) => OneClickService.getQuote(req));

  let quote: QuoteResponse;
  try {
    configureOneClickClient();
    const request = buildRefundQuoteRequest(params, refundable);
    quote = await quoteFn(request);
  } catch (err) {
    await reopenSession(sessionId);
    throw new RefundError(
      "ERR_AURORA_REFUND_UNAVAILABLE",
      `Reverse Aurora Intent quote failed: ${err instanceof Error ? err.message : String(err)}`,
      502,
    );
  }

  const merchant = await query<{ id: string }>(
    "SELECT id FROM x402_merchants ORDER BY created_at ASC LIMIT 1",
  );
  if (merchant.rows[0]) {
    await query(
      `INSERT INTO x402_usage_receipts
         (session_id, merchant_id, request_correlation_id, payment_scheme,
          charged_micro_usdc, cumulative_session_spend_micro_usdc,
          refund_triggered, aurora_refund_quote_id)
       VALUES ($1,$2,$3,'zkapi-runtime-key',0,0,TRUE,$4)`,
      [sessionId, merchant.rows[0].id, `refund_${randomUUID()}`, quote.correlationId],
    );
  }

  return {
    auroraRefundQuoteId: quote.correlationId,
    refundedMicroUsdc: refundable,
    status: "PROCESSING_REFUND",
  };
}

async function reopenSession(sessionId: string): Promise<void> {
  await query(
    `UPDATE zk_runtime_sessions
        SET status = 'ACTIVE', updated_at = now()
      WHERE id = $1 AND status = 'CLOSED_REFUNDED'`,
    [sessionId],
  ).catch(() => undefined);
}
