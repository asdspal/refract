import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { closePool, query } from "../../src/db/index";
import {
  withX402Gate,
  X402_SCHEMES,
  type X402Handler,
} from "../../src/lib/x402/gatewayMiddleware";
import {
  verifySchnorrUsageReceipt,
} from "../../src/lib/x402/schnorrReceiptSigner";
import {
  authorizeAndDeductRuntimeKey,
  hashRuntimeKey,
} from "../../src/lib/x402/runtimeKeyMeter";

const root = resolve(__dirname, "../..");
const ENDPOINT = "/test/x402-gw";
const PRICE = 15_000;
const sessions: string[] = [];
let merchantId = "";

function hex32(): string {
  return "0x" + randomBytes(32).toString("hex");
}

async function insertSession(opts: {
  remaining: number;
  maxPerRequest: number;
}): Promise<{ id: string; token: string }> {
  const token = `rk_live_test_${randomUUID()}`;
  const res = await query<{ id: string }>(
    `INSERT INTO zk_runtime_sessions
       (nullifier_hash_hex, merkle_root_used_hex, runtime_key_hash,
        principal_micro_usdc, remaining_micro_usdc, max_per_request_micro_usdc,
        daily_cap_micro_usdc, status, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6,100000000,'ACTIVE', now() + interval '24 hours')
     RETURNING id`,
    [
      hex32(),
      "0x" + "00".repeat(32),
      hashRuntimeKey(token),
      opts.remaining,
      opts.remaining,
      opts.maxPerRequest,
    ],
  );
  sessions.push(res.rows[0].id);
  return { id: res.rows[0].id, token };
}

function signature(token: string): string {
  return Buffer.from(
    JSON.stringify({ scheme: "zkapi-runtime-key", token }),
  ).toString("base64");
}

async function sessionRemaining(id: string): Promise<number> {
  const res = await query<{ remaining: string }>(
    "SELECT remaining_micro_usdc::text AS remaining FROM zk_runtime_sessions WHERE id = $1",
    [id],
  );
  return Number(res.rows[0].remaining);
}

const okHandler: X402Handler = async (request, ctx) =>
  new Response(
    JSON.stringify({
      ok: true,
      remainingMicroUsdc: ctx.remainingMicroUsdc,
      walletBytesReceived: 0,
      seenHeaders: [...request.headers.keys()],
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );

const failHandler: X402Handler = async () =>
  new Response(JSON.stringify({ error: "upstream boom" }), { status: 502 });

beforeAll(async () => {
  const upSql = readFileSync(
    resolve(root, "src/db/migrations/0001_init_refract_schema.up.sql"),
    "utf8",
  );
  await query(upSql);
  await query("DELETE FROM x402_merchants WHERE endpoint_pattern = $1", [ENDPOINT]);
  const merchant = await query<{ id: string }>(
    `INSERT INTO x402_merchants
       (name, solana_pubkey, endpoint_pattern, price_per_call_micro_usdc)
     VALUES ('Test Merchant', $1, $2, $3) RETURNING id`,
    [`TestMerchant${randomUUID().slice(0, 8)}`, ENDPOINT, PRICE],
  );
  merchantId = merchant.rows[0].id;
});

afterAll(async () => {
  if (sessions.length > 0) {
    await query("DELETE FROM x402_usage_receipts WHERE session_id = ANY($1)", [sessions]);
    await query("DELETE FROM zk_runtime_sessions WHERE id = ANY($1)", [sessions]);
  }
  await query("DELETE FROM x402_merchants WHERE endpoint_pattern = $1", [ENDPOINT]);
  await closePool();
});

describe("x402 v2 gateway", () => {
  it("challenges unpaid requests with a valid PAYMENT-REQUIRED header in < 50ms", async () => {
    const gated = withX402Gate(okHandler, ENDPOINT);
    const started = performance.now();
    const res = await gated(
      new Request("http://localhost/test/x402-gw", { method: "POST" }),
    );
    const latency = performance.now() - started;
    expect(res.status).toBe(402);
    expect(latency).toBeLessThan(50);
    const header = res.headers.get("PAYMENT-REQUIRED");
    expect(header).toBeTruthy();
    const challenge = JSON.parse(
      Buffer.from(header!, "base64").toString("utf8"),
    );
    expect(challenge.priceMicroUsdc).toBe(PRICE);
    expect(challenge.schemes).toEqual(X402_SCHEMES);
    expect(challenge.version).toBe("2.0");
    expect(res.headers.get("X-Correlation-Id")).toMatch(/^req_/);
  });

  it("authorizes a paid call, signs a verifiable receipt, and splits merchant revenue", async () => {
    const { id, token } = await insertSession({
      remaining: 1_000_000,
      maxPerRequest: 100_000,
    });
    const before = await query<{ staked: string; liquid: string }>(
      "SELECT defi_staked_micro_usdc::text AS staked, liquid_balance_micro_usdc::text AS liquid FROM x402_merchants WHERE id = $1",
      [merchantId],
    );
    const gated = withX402Gate(okHandler, ENDPOINT);
    const res = await gated(
      new Request("http://localhost/test/x402-gw", {
        method: "POST",
        headers: {
          "PAYMENT-SIGNATURE": signature(token),
          "x-forwarded-for": "203.0.113.9",
          "content-type": "application/json",
        },
        body: "{}",
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.remainingMicroUsdc).toBe(985_000);
    expect(body.walletBytesReceived).toBe(0);
    expect(body.seenHeaders).not.toContain("x-forwarded-for");
    expect(body.seenHeaders).not.toContain("payment-signature");

    const receipt = res.headers.get("X-ZKAPI-RECEIPT");
    expect(receipt).toBeTruthy();
    expect(verifySchnorrUsageReceipt(receipt!)).toBe(true);
    expect(res.headers.get("Server-Timing")).toMatch(/x402-verify-dur;dur=/);
    expect(await sessionRemaining(id)).toBe(985_000);

    const after = await query<{ staked: string; liquid: string }>(
      "SELECT defi_staked_micro_usdc::text AS staked, liquid_balance_micro_usdc::text AS liquid FROM x402_merchants WHERE id = $1",
      [merchantId],
    );
    expect(Number(after.rows[0].staked) - Number(before.rows[0].staked)).toBe(13_500);
    expect(Number(after.rows[0].liquid) - Number(before.rows[0].liquid)).toBe(1_500);

    const receiptRow = await query<{ refund_triggered: boolean; sig: string }>(
      "SELECT refund_triggered, schnorr_signature_hex AS sig FROM x402_usage_receipts WHERE session_id = $1",
      [id],
    );
    expect(receiptRow.rows).toHaveLength(1);
    expect(receiptRow.rows[0].sig).toBeTruthy();
  });

  it("blocks a simulated $2.50 prompt-injection against a $0.10 cap", async () => {
    const { id, token } = await insertSession({
      remaining: 1_000_000,
      maxPerRequest: 100_000,
    });
    const gated = withX402Gate(okHandler, ENDPOINT);
    const res = await gated(
      new Request("http://localhost/test/x402-gw", {
        method: "POST",
        headers: {
          "PAYMENT-SIGNATURE": signature(token),
          "x-simulate-endpoint-cost-micro-usdc": "2500000",
        },
      }),
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe("ERR_SPEND_CAP_EXCEEDED");
    expect(await sessionRemaining(id)).toBe(1_000_000);
  });

  it("rolls the charge back when the upstream handler returns 5xx", async () => {
    const { id, token } = await insertSession({
      remaining: 1_000_000,
      maxPerRequest: 100_000,
    });
    const gated = withX402Gate(failHandler, ENDPOINT);
    const res = await gated(
      new Request("http://localhost/test/x402-gw", {
        method: "POST",
        headers: { "PAYMENT-SIGNATURE": signature(token) },
      }),
    );
    expect(res.status).toBe(502);
    expect(await sessionRemaining(id)).toBe(1_000_000);
  });

  it("rejects unknown runtime keys with 401", async () => {
    const gated = withX402Gate(okHandler, ENDPOINT);
    const res = await gated(
      new Request("http://localhost/test/x402-gw", {
        method: "POST",
        headers: { "PAYMENT-SIGNATURE": signature(`rk_live_unknown_${randomUUID()}`) },
      }),
    );
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("ERR_INVALID_RUNTIME_KEY");
  });
});
