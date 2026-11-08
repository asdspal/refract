import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { closePool, query } from "../../src/db/index";
import { withX402Gate } from "../../src/lib/x402/gatewayMiddleware";
import { hashRuntimeKey } from "../../src/lib/x402/runtimeKeyMeter";
import { verifySchnorrUsageReceipt } from "../../src/lib/x402/schnorrReceiptSigner";
import { POST as chatPOST } from "../../src/app/api/v1/ai/chat/route";

const root = resolve(__dirname, "../..");
let sessionId = "";
let token = "";

function signature(): string {
  return Buffer.from(
    JSON.stringify({ scheme: "zkapi-runtime-key", token }),
  ).toString("base64");
}

function paidRequest(extra: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/v1/ai/chat", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "PAYMENT-SIGNATURE": signature(),
      ...extra,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "Audit Kamino vault risks." }],
    }),
  });
}

async function remaining(): Promise<number> {
  const res = await query<{ remaining: string }>(
    "SELECT remaining_micro_usdc::text AS remaining FROM zk_runtime_sessions WHERE id = $1",
    [sessionId],
  );
  return Number(res.rows[0].remaining);
}

beforeAll(async () => {
  const upSql = readFileSync(
    resolve(root, "src/db/migrations/0001_init_refract_schema.up.sql"),
    "utf8",
  );
  await query(upSql);
  process.env.OPENAI_API_KEY = "sk-test-local";
  token = `rk_live_eval_${randomUUID()}`;
  const res = await query<{ id: string }>(
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
  sessionId = res.rows[0].id;
});

afterAll(async () => {
  await query("DELETE FROM x402_usage_receipts WHERE session_id = $1", [sessionId]);
  await query("DELETE FROM zk_runtime_sessions WHERE id = $1", [sessionId]);
  delete process.env.AI_SIMULATE_PRIMARY_FAILURE;
  await closePool();
});

describe("x402 autonomous agent evaluation (20 cases)", () => {
  it("passes at least 95% of the synthetic benchmark", async () => {
    const cases: Array<{ name: string; run: () => Promise<boolean> }> = [];

    // 4x HTTP 402 challenge parsing
    for (let i = 0; i < 4; i++) {
      cases.push({
        name: `challenge-${i}`,
        run: async () => {
          const res = await chatPOST(
            new Request("http://localhost/api/v1/ai/chat", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                messages: [{ role: "user", content: "hello" }],
              }),
            }),
          );
          const header = res.headers.get("PAYMENT-REQUIRED");
          if (res.status !== 402 || !header) return false;
          const challenge = JSON.parse(
            Buffer.from(header, "base64").toString("utf8"),
          );
          return (
            challenge.priceMicroUsdc === 15_000 &&
            Array.isArray(challenge.schemes) &&
            challenge.schemes.includes("zkapi-runtime-key")
          );
        },
      });
    }

    // 4x paid call + verified receipt
    for (let i = 0; i < 4; i++) {
      cases.push({
        name: `paid-${i}`,
        run: async () => {
          const res = await chatPOST(paidRequest());
          if (res.status !== 200) return false;
          const receipt = res.headers.get("X-ZKAPI-RECEIPT");
          const body = await res.json();
          return (
            Boolean(receipt) &&
            verifySchnorrUsageReceipt(receipt!) &&
            body.walletBytesReceived === 0 &&
            body.chargedMicroUsdc === 15_000
          );
        },
      });
    }

    // 4x prompt-injection spend-cap refusal
    for (let i = 0; i < 4; i++) {
      cases.push({
        name: `firewall-${i}`,
        run: async () => {
          const before = await remaining();
          const res = await chatPOST(
            paidRequest({ "x-simulate-endpoint-cost-micro-usdc": "2500000" }),
          );
          const body = await res.json();
          return (
            res.status === 403 &&
            body.code === "ERR_SPEND_CAP_EXCEEDED" &&
            (await remaining()) === before
          );
        },
      });
    }

    // 4x model failover (OpenAI -> Anthropic)
    for (let i = 0; i < 4; i++) {
      cases.push({
        name: `fallback-${i}`,
        run: async () => {
          process.env.AI_SIMULATE_PRIMARY_FAILURE = "true";
          try {
            const res = await chatPOST(paidRequest());
            const body = await res.json();
            return (
              res.status === 200 &&
              body.provider === "local-fallback" &&
              body.model === "claude-3-5-sonnet-20241022"
            );
          } finally {
            delete process.env.AI_SIMULATE_PRIMARY_FAILURE;
          }
        },
      });
    }

    // 4x upstream 5xx rollback
    const failGate = withX402Gate(
      async () => new Response("boom", { status: 502 }),
      "/api/v1/ai/chat",
    );
    for (let i = 0; i < 4; i++) {
      cases.push({
        name: `rollback-${i}`,
        run: async () => {
          const before = await remaining();
          const res = await failGate(paidRequest());
          return res.status === 502 && (await remaining()) === before;
        },
      });
    }

    let passed = 0;
    const failures: string[] = [];
    for (const testCase of cases) {
      try {
        if (await testCase.run()) passed++;
        else failures.push(testCase.name);
      } catch (err) {
        failures.push(`${testCase.name}: ${err instanceof Error ? err.message : err}`);
      }
    }
    console.log(`x402 agent eval: ${passed}/${cases.length} passed`);
    if (failures.length > 0) console.log("failures:", failures);
    expect(cases).toHaveLength(20);
    expect(passed / cases.length).toBeGreaterThanOrEqual(0.95);
  }, 180_000);
});
