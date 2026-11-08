import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { QuoteRequest, QuoteResponse } from "@defuse-protocol/one-click-sdk-typescript";
import { closePool, query } from "../../src/db/index";
import {
  RefundError,
  refundRuntimeSession,
} from "../../src/lib/aurora/reverseRefundService";
import {
  authorizeAndDeductRuntimeKey,
  getRedis,
  hashRuntimeKey,
} from "../../src/lib/x402/runtimeKeyMeter";
import { POST as refundPOST } from "../../src/app/api/v1/intents/refund/route";

const root = resolve(__dirname, "../..");
const ARB_USDC =
  "nep141:arb-0xaf88d065e77c8cc2239327c5edb3a432268e5831.omft.near";
const RECIPIENT = "0x71C95911E9a5D330f4D621842EC243EE1343292e";
const sessionIds: string[] = [];

function hex32(): string {
  return "0x" + randomBytes(32).toString("hex");
}

async function insertSession(opts: {
  remaining: number;
  bonus: number;
}): Promise<{ id: string; token: string; hash: string }> {
  const token = `rk_live_test_${randomUUID()}`;
  const hash = hashRuntimeKey(token);
  const res = await query<{ id: string }>(
    `INSERT INTO zk_runtime_sessions
       (nullifier_hash_hex, merkle_root_used_hex, runtime_key_hash,
        principal_micro_usdc, yield_subsidy_micro_usdc, remaining_micro_usdc,
        is_optimistic, status, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6,FALSE,'ACTIVE', now() + interval '24 hours')
     RETURNING id`,
    [
      hex32(),
      "0x" + "00".repeat(32),
      hash,
      opts.remaining - opts.bonus,
      opts.bonus,
      opts.remaining,
    ],
  );
  sessionIds.push(res.rows[0].id);
  return { id: res.rows[0].id, token, hash };
}

function fakeQuote(correlationId = randomUUID()): QuoteResponse {
  return {
    correlationId,
    timestamp: new Date().toISOString(),
    signature: "test-signature",
    quoteRequest: {} as QuoteRequest,
    quote: {
      depositAddress: "Eu5JuwNr6FjHAZjCtuXMZnhY9Qk8tTrQuVHtwmTzyp3F",
      amountIn: "8450000",
      amountInFormatted: "8.45",
      amountInUsd: "8.45",
      minAmountIn: "8450000",
      amountOut: "8000000",
      amountOutFormatted: "8.0",
      amountOutUsd: "8.0",
      minAmountOut: "7900000",
      timeEstimate: 30,
    },
  };
}

beforeAll(async () => {
  const upSql = readFileSync(
    resolve(root, "src/db/migrations/0001_init_refract_schema.up.sql"),
    "utf8",
  );
  await query(upSql);
});

afterAll(async () => {
  if (sessionIds.length > 0) {
    await query("DELETE FROM x402_usage_receipts WHERE session_id = ANY($1)", [
      sessionIds,
    ]);
    await query("DELETE FROM zk_runtime_sessions WHERE id = ANY($1)", [sessionIds]);
  }
  await closePool();
});

describe("reverse-intent cross-chain refund", () => {
  it("closes the session atomically and initiates a reverse Aurora quote", async () => {
    const { id, token, hash } = await insertSession({
      remaining: 8_870_000, // 8.45M principal + 0.42M subsidy
      bonus: 420_000,
    });

    const redis = getRedis();
    if (redis) {
      await redis.hset(`refract:rk:${hash}`, {
        session_id: id,
        remaining: "8870000",
        spent_today: "0",
        max_per_request: "100000",
        daily_cap: "2000000",
        status: "ACTIVE",
        expires_at: String(Math.floor(Date.now() / 1000) + 3600),
      });
    }

    const quoteId = randomUUID();
    const result = await refundRuntimeSession(
      token,
      {
        destinationChain: "arbitrum",
        destinationAsset: ARB_USDC,
        recipientAddress: RECIPIENT,
      },
      { quoteFn: async () => fakeQuote(quoteId) },
    );

    expect(result.status).toBe("PROCESSING_REFUND");
    expect(result.refundedMicroUsdc).toBe(8_450_000);
    expect(result.auroraRefundQuoteId).toBe(quoteId);

    const session = await query<{ status: string }>(
      "SELECT status FROM zk_runtime_sessions WHERE id = $1",
      [id],
    );
    expect(session.rows[0].status).toBe("CLOSED_REFUNDED");

    const receipt = await query<{
      refund_triggered: boolean;
      aurora_refund_quote_id: string;
    }>(
      "SELECT refund_triggered, aurora_refund_quote_id FROM x402_usage_receipts WHERE session_id = $1",
      [id],
    );
    expect(receipt.rows[0].refund_triggered).toBe(true);
    expect(receipt.rows[0].aurora_refund_quote_id).toBe(quoteId);

    if (redis) {
      expect(await redis.exists(`refract:rk:${hash}`)).toBe(0);
    }
  }, 60_000);

  it("rejects a double refund with 409 and blocks post-refund spending", async () => {
    const { token } = await insertSession({ remaining: 8_870_000, bonus: 420_000 });
    const params = {
      destinationChain: "arbitrum",
      destinationAsset: ARB_USDC,
      recipientAddress: RECIPIENT,
    };
    await refundRuntimeSession(token, params, { quoteFn: async () => fakeQuote() });

    await expect(
      refundRuntimeSession(token, params, { quoteFn: async () => fakeQuote() }),
    ).rejects.toMatchObject({ code: "ERR_SESSION_ALREADY_CLOSED", status: 409 });

    await expect(
      authorizeAndDeductRuntimeKey(token, 1_000),
    ).rejects.toMatchObject({ code: "ERR_RUNTIME_SESSION_INACTIVE" });
  }, 60_000);

  it("prevents yield-subsidy farming below the solver minimum", async () => {
    const { id, token } = await insertSession({
      remaining: 1_200_000,
      bonus: 420_000,
    });
    await expect(
      refundRuntimeSession(
        token,
        {
          destinationChain: "arbitrum",
          destinationAsset: ARB_USDC,
          recipientAddress: RECIPIENT,
        },
        { quoteFn: async () => fakeQuote() },
      ),
    ).rejects.toBeInstanceOf(RefundError);

    const session = await query<{ status: string }>(
      "SELECT status FROM zk_runtime_sessions WHERE id = $1",
      [id],
    );
    expect(session.rows[0].status).toBe("ACTIVE");
  }, 60_000);

  it("route enforces PAYMENT-SIGNATURE and validates the body", async () => {
    const missing = await refundPOST(
      new Request("http://localhost/api/v1/intents/refund", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          destinationChain: "arbitrum",
          destinationAsset: ARB_USDC,
          recipientAddress: RECIPIENT,
        }),
      }),
    );
    expect(missing.status).toBe(401);
    expect((await missing.json()).code).toBe("ERR_PAYMENT_SIGNATURE_REQUIRED");
  });

  it("route processes a refund with a base64 PAYMENT-SIGNATURE", async () => {
    const { token } = await insertSession({ remaining: 8_870_000, bonus: 420_000 });
    const signature = Buffer.from(
      JSON.stringify({ scheme: "zkapi-runtime-key", token }),
    ).toString("base64");
    const res = await refundPOST(
      new Request("http://localhost/api/v1/intents/refund", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "PAYMENT-SIGNATURE": signature,
        },
        body: JSON.stringify({
          destinationChain: "arbitrum",
          destinationAsset: ARB_USDC,
          recipientAddress: RECIPIENT,
        }),
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("PROCESSING_REFUND");
    expect(body.refundedMicroUsdc).toBe(8_450_000);
  }, 60_000);
});
