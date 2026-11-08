import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { getPool, query } from "../../db/index";
import {
  authorizeAndDeductRuntimeKey,
  rollbackRuntimeKeyCharge,
  SpendPolicyError,
} from "./runtimeKeyMeter";
import {
  encodeReceiptHeader,
  signUsageReceipt,
} from "./schnorrReceiptSigner";

export const X402_SCHEMES = [
  "zkapi-runtime-key",
  "zkapi-groth16-bn254",
  "solana-spl",
] as const;

export const DEFAULT_PRICE_MICRO_USDC = 15_000;

export interface X402Context {
  sessionId: string;
  chargedMicroUsdc: number;
  remainingMicroUsdc: number;
  spentTodayMicroUsdc: number;
  correlationId: string;
  scheme: string;
  verifyDurationMs: number;
}

export type X402Handler = (
  request: Request,
  context: X402Context,
) => Promise<Response> | Response;

interface MerchantRow {
  id: string;
  solana_pubkey: string;
  price_per_call_micro_usdc: string;
}

const IDENTIFYING_HEADERS = new Set([
  "x-forwarded-for",
  "x-real-ip",
  "cf-connecting-ip",
  "x-client-ip",
  "forwarded",
  "payment-signature",
  "authorization",
  "cookie",
]);

function toBase64Json(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64");
}

function fromBase64Json(value: string): Record<string, unknown> | null {
  try {
    return JSON.parse(Buffer.from(value.trim(), "base64").toString("utf8"));
  } catch {
    return null;
  }
}

function decodePaymentSignature(header: string): {
  scheme: string;
  token: string;
} {
  const decoded = fromBase64Json(header);
  if (decoded && typeof decoded.token === "string") {
    return {
      scheme:
        typeof decoded.scheme === "string"
          ? decoded.scheme
          : "zkapi-runtime-key",
      token: decoded.token,
    };
  }
  return { scheme: "zkapi-runtime-key", token: header };
}

async function getMerchant(endpointPattern: string): Promise<MerchantRow | null> {
  const exact = await query<MerchantRow>(
    `SELECT id, solana_pubkey, price_per_call_micro_usdc::text
       FROM x402_merchants WHERE endpoint_pattern = $1 LIMIT 1`,
    [endpointPattern],
  );
  if (exact.rows[0]) return exact.rows[0];
  const fallback = await query<MerchantRow>(
    `SELECT id, solana_pubkey, price_per_call_micro_usdc::text
       FROM x402_merchants ORDER BY created_at ASC LIMIT 1`,
  );
  return fallback.rows[0] ?? null;
}

function stripIdentifyingHeaders(request: Request): Request {
  const headers = new Headers(request.headers);
  for (const name of [...headers.keys()]) {
    if (IDENTIFYING_HEADERS.has(name.toLowerCase())) headers.delete(name);
  }
  return new Request(request, { headers });
}

function challengeResponse(
  price: number,
  merchant: MerchantRow | null,
  correlationId: string,
): Response {
  const challenge = {
    version: "2.0",
    network: process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? "devnet",
    priceMicroUsdc: price,
    payTo: merchant?.solana_pubkey ?? "RefractAiMerchant1111111111111111111111111",
    schemes: X402_SCHEMES,
    zkapiVaultProgramId:
      process.env.NEXT_PUBLIC_REFRACT_VAULT_PROGRAM_ID ??
      "HyeAVxJxt37ndAE2LJBKJ36j8vKLv6PezvwxA2NsmhvH",
    auroraIntentsQuoteEndpoint: "/api/v1/intents/quote",
  };
  return new Response(
    JSON.stringify({
      code: "ERR_PAYMENT_REQUIRED",
      message: "HTTP 402 Payment Required. Attach a PAYMENT-SIGNATURE header.",
    }),
    {
      status: 402,
      headers: {
        "content-type": "application/json",
        "PAYMENT-REQUIRED": toBase64Json(challenge),
        "X-Correlation-Id": correlationId,
      },
    },
  );
}

function errorResponse(
  status: number,
  code: string,
  message: string,
  correlationId: string,
): Response {
  return new Response(JSON.stringify({ code, message, correlationId }), {
    status,
    headers: {
      "content-type": "application/json",
      "X-Correlation-Id": correlationId,
    },
  });
}

async function recordReceipt(args: {
  sessionId: string;
  merchantId: string | null;
  correlationId: string;
  scheme: string;
  charged: number;
  cumulativeSpend: number;
  signatureHex: string | null;
  upstreamStatus: number | null;
  refundTriggered: boolean;
}): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const merchantId = args.merchantId ?? (await firstMerchantId(client));
    await client.query(
      `INSERT INTO x402_usage_receipts
         (session_id, merchant_id, request_correlation_id, payment_scheme,
          charged_micro_usdc, cumulative_session_spend_micro_usdc,
          schnorr_signature_hex, upstream_http_status, refund_triggered)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        args.sessionId,
        merchantId,
        args.correlationId,
        args.scheme,
        args.charged,
        args.cumulativeSpend,
        args.signatureHex,
        args.upstreamStatus,
        args.refundTriggered,
      ],
    );
    if (merchantId && !args.refundTriggered) {
      const staked = Math.floor((args.charged * 9_000) / 10_000);
      const liquid = args.charged - staked;
      await client.query(
        `UPDATE x402_merchants
            SET defi_staked_micro_usdc = defi_staked_micro_usdc + $2,
                liquid_balance_micro_usdc = liquid_balance_micro_usdc + $3
          WHERE id = $1`,
        [merchantId, staked, liquid],
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

async function firstMerchantId(client: PoolClient): Promise<string | null> {
  const res = await client.query<{ id: string }>(
    "SELECT id FROM x402_merchants ORDER BY created_at ASC LIMIT 1",
  );
  return res.rows[0]?.id ?? null;
}

/**
 * Wrap an endpoint with x402 v2 payment gating:
 * - no PAYMENT-SIGNATURE -> HTTP 402 + base64 PAYMENT-REQUIRED
 * - valid runtime key -> atomic metered authorization, signed receipt, merchant 90/10 split
 * - handler failure -> compensating rollback
 */
export function withX402Gate(
  handler: X402Handler,
  endpointPattern: string,
) {
  return async function gated(request: Request): Promise<Response> {
    const correlationId = `req_${randomUUID()}`;
    const started = performance.now();

    let merchant: MerchantRow | null = null;
    try {
      merchant = await getMerchant(endpointPattern);
    } catch {
      merchant = null;
    }
    const configuredPrice = merchant
      ? Number(merchant.price_per_call_micro_usdc)
      : DEFAULT_PRICE_MICRO_USDC;
    const simulatedCost = request.headers.get(
      "x-simulate-endpoint-cost-micro-usdc",
    );
    const price =
      simulatedCost && /^\d+$/.test(simulatedCost)
        ? Number(simulatedCost)
        : configuredPrice;

    const signatureHeader = request.headers.get("PAYMENT-SIGNATURE");
    if (!signatureHeader) {
      return challengeResponse(price, merchant, correlationId);
    }

    const { scheme, token } = decodePaymentSignature(signatureHeader);
    if (scheme !== "zkapi-runtime-key") {
      return errorResponse(
        402,
        "ERR_SCHEME_NOT_SUPPORTED",
        `Payment scheme ${scheme} is advertised but only zkapi-runtime-key is active in this build.`,
        correlationId,
      );
    }

    let auth;
    try {
      auth = await authorizeAndDeductRuntimeKey(token, price);
    } catch (err) {
      if (err instanceof SpendPolicyError) {
        return errorResponse(err.status, err.code, err.message, correlationId);
      }
      return errorResponse(
        502,
        "ERR_X402_VERIFY_FAILED",
        "Runtime key verification failed.",
        correlationId,
      );
    }
    const verifyDurationMs = performance.now() - started;

    let response: Response;
    try {
      response = await handler(stripIdentifyingHeaders(request), {
        sessionId: auth.sessionId,
        chargedMicroUsdc: price,
        remainingMicroUsdc: auth.remainingMicroUsdc,
        spentTodayMicroUsdc: auth.spentTodayMicroUsdc,
        correlationId,
        scheme,
        verifyDurationMs,
      });
    } catch (err) {
      await rollbackRuntimeKeyCharge(auth.sessionId, price);
      const reason = err instanceof Error ? err.message : String(err);
      return errorResponse(
        502,
        "ERR_UPSTREAM_API_FAILURE",
        `Upstream handler failed; the charge was rolled back. ${reason.slice(0, 180)}`,
        correlationId,
      );
    }

    if (response.status >= 500) {
      await rollbackRuntimeKeyCharge(auth.sessionId, price).catch(() => undefined);
      await recordReceipt({
        sessionId: auth.sessionId,
        merchantId: merchant?.id ?? null,
        correlationId,
        scheme,
        charged: 0,
        cumulativeSpend: auth.spentTodayMicroUsdc,
        signatureHex: null,
        upstreamStatus: response.status,
        refundTriggered: true,
      }).catch(() => undefined);
      return response;
    }

    let receipt;
    try {
      receipt = signUsageReceipt({
        sessionId: auth.sessionId,
        correlationId,
        chargedMicroUsdc: price,
        remainingMicroUsdc: auth.remainingMicroUsdc,
        timestamp: Date.now(),
      });
    } catch (err) {
      await rollbackRuntimeKeyCharge(auth.sessionId, price).catch(() => undefined);
      const reason = err instanceof Error ? err.message : String(err);
      return errorResponse(
        502,
        "ERR_RECEIPT_SIGNING_FAILED",
        `Receipt signing failed; the charge was rolled back. ${reason.slice(0, 160)}`,
        correlationId,
      );
    }

    await recordReceipt({
      sessionId: auth.sessionId,
      merchantId: merchant?.id ?? null,
      correlationId,
      scheme,
      charged: price,
      cumulativeSpend: auth.spentTodayMicroUsdc,
      signatureHex: receipt.signature,
      upstreamStatus: response.status,
      refundTriggered: false,
    }).catch(() => undefined);

    const headers = new Headers(response.headers);
    headers.set("X-ZKAPI-RECEIPT", encodeReceiptHeader(receipt));
    headers.set("X-Correlation-Id", correlationId);
    headers.set(
      "Server-Timing",
      `x402-verify-dur;dur=${verifyDurationMs.toFixed(1)}`,
    );
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };
}
