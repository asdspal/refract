import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { closePool, query } from "../../src/db/index";
import { withX402Gate } from "../../src/lib/x402/gatewayMiddleware";
import { hashRuntimeKey } from "../../src/lib/x402/runtimeKeyMeter";

const root = resolve(__dirname, "../..");
const ENDPOINT = "/test/x402-load";
const PRICE = 15_000;
let sessionId = "";
let merchantId = "";

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
     VALUES ('Load Merchant', $1, $2, $3) RETURNING id`,
    [`LoadMerchant${randomUUID().slice(0, 8)}`, ENDPOINT, PRICE],
  );
  merchantId = merchant.rows[0].id;
});

afterAll(async () => {
  if (sessionId) {
    await query("DELETE FROM x402_usage_receipts WHERE session_id = $1", [sessionId]);
    await query("DELETE FROM zk_runtime_sessions WHERE id = $1", [sessionId]);
  }
  await query("DELETE FROM x402_merchants WHERE endpoint_pattern = $1", [ENDPOINT]);
  await closePool();
});

describe("x402 verify latency (100 sequential calls)", () => {
  it("p95 gateway verification stays within the local budget", async () => {
    const token = `rk_live_load_${randomUUID()}`;
    const inserted = await query<{ id: string }>(
      `INSERT INTO zk_runtime_sessions
         (nullifier_hash_hex, merkle_root_used_hex, runtime_key_hash,
          principal_micro_usdc, remaining_micro_usdc, max_per_request_micro_usdc,
          daily_cap_micro_usdc, status, expires_at)
       VALUES ($1,$2,$3,100000000,100000000,100000,100000000,'ACTIVE', now() + interval '24 hours')
       RETURNING id`,
      [
        "0x" + randomBytes(32).toString("hex"),
        "0x" + "00".repeat(32),
        hashRuntimeKey(token),
      ],
    );
    sessionId = inserted.rows[0].id;
    const signature = Buffer.from(
      JSON.stringify({ scheme: "zkapi-runtime-key", token }),
    ).toString("base64");
    const gated = withX402Gate(
      async () => new Response("{}", { status: 200 }),
      ENDPOINT,
    );

    const durations: number[] = [];
    for (let i = 0; i < 100; i++) {
      const res = await gated(
        new Request("http://localhost/test/x402-load", {
          method: "POST",
          headers: { "PAYMENT-SIGNATURE": signature },
        }),
      );
      expect(res.status).toBe(200);
      const timing = res.headers.get("Server-Timing") ?? "";
      const match = /x402-verify-dur;dur=([0-9.]+)/.exec(timing);
      expect(match).toBeTruthy();
      durations.push(Number(match![1]));
    }

    durations.sort((a, b) => a - b);
    const p50 = durations[Math.floor(durations.length * 0.5)];
    const p95 = durations[Math.floor(durations.length * 0.95)];
    console.log(
      `x402 gateway verify (local -> Upstash -> Postgres): p50=${p50.toFixed(1)}ms p95=${p95.toFixed(1)}ms`,
    );
    // Local network to Upstash is slower than Vercel colocation; the 15ms NFR
    // is re-measured in production. Guard against pathological regressions.
    expect(p95).toBeLessThan(200);
  }, 180_000);
});
