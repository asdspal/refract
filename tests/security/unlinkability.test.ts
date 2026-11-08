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
const ORIGIN_WALLET = "0x71C95911E9a5D330f4D621842EC243EE1343292e";
const sessions: string[] = [];
const nullifiers: string[] = [];

async function insertSession(maxPerRequest = 100_000) {
  const token = `rk_live_sec_${randomUUID()}`;
  const nullifier = "0x" + randomBytes(32).toString("hex");
  const res = await query<{ id: string }>(
    `INSERT INTO zk_runtime_sessions
       (nullifier_hash_hex, merkle_root_used_hex, runtime_key_hash,
        principal_micro_usdc, remaining_micro_usdc, max_per_request_micro_usdc,
        daily_cap_micro_usdc, status, expires_at)
     VALUES ($1,$2,$3,100000000,100000000,$4,100000000,'ACTIVE', now() + interval '24 hours')
     RETURNING id`,
    [nullifier, "0x" + "00".repeat(32), hashRuntimeKey(token), maxPerRequest],
  );
  sessions.push(res.rows[0].id);
  nullifiers.push(nullifier);
  return { id: res.rows[0].id, token, nullifier };
}

function signature(token: string): string {
  return Buffer.from(
    JSON.stringify({ scheme: "zkapi-runtime-key", token }),
  ).toString("base64");
}

function chatRequest(
  token: string,
  content = "Audit Kamino vault risks.",
  extraHeaders: Record<string, string> = {},
) {
  return new Request("http://localhost/api/v1/ai/chat", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "PAYMENT-SIGNATURE": signature(token),
      "x-forwarded-for": "203.0.113.9",
      "x-real-ip": "203.0.113.9",
      ...extraHeaders,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content }],
    }),
  });
}

beforeAll(async () => {
  const upSql = readFileSync(
    resolve(root, "src/db/migrations/0001_init_refract_schema.up.sql"),
    "utf8",
  );
  await query(upSql);
  process.env.OPENAI_API_KEY = "sk-test-local";
});

afterAll(async () => {
  if (sessions.length > 0) {
    await query("DELETE FROM x402_usage_receipts WHERE session_id = ANY($1)", [sessions]);
    await query("DELETE FROM zk_runtime_sessions WHERE id = ANY($1)", [sessions]);
  }
  await closePool();
});

describe("x402 unlinkability", () => {
  it(
    "returns 0 wallet bytes to the merchant and strips IP/payment headers",
    async () => {
      const { id, token, nullifier } = await insertSession();
      const res = await chatPOST(chatRequest(token));
      expect(res.status).toBe(200);
      expect(res.headers.get("X-ZKAPI-RECEIPT")).toBeTruthy();
      expect(verifySchnorrUsageReceipt(res.headers.get("X-ZKAPI-RECEIPT")!)).toBe(true);

      const bodyText = await res.text();
      expect(bodyText).not.toContain(ORIGIN_WALLET);
      expect(bodyText).not.toContain(process.env.SOLANA_DEPLOYER_PUBKEY ?? "@@none@@");
      expect(bodyText).not.toContain(nullifier);
      expect(JSON.parse(bodyText).walletBytesReceived).toBe(0);

      // Probe: the handler must not observe IP or payment headers.
      let seen: string[] = [];
      const probe = withX402Gate(async (request) => {
        seen = [...request.headers.keys()];
        return new Response("{}", { status: 200 });
      }, "/api/v1/ai/chat");
      await probe(chatRequest(token));

      for (const header of [
        "x-forwarded-for",
        "x-real-ip",
        "cf-connecting-ip",
        "payment-signature",
        "authorization",
        "cookie",
      ]) {
        expect(seen).not.toContain(header);
      }

      // The receipt/session ledger contains no wallet identifiers.
      const receipt = await query("SELECT * FROM x402_usage_receipts WHERE session_id = $1", [id]);
      const receiptJson = JSON.stringify(receipt.rows).toLowerCase();
      expect(receiptJson).not.toContain(ORIGIN_WALLET.toLowerCase());
      expect(receiptJson).not.toContain(
        (process.env.SOLANA_DEPLOYER_PUBKEY ?? "@@none@@").toLowerCase(),
      );

      const fks = await query<{ count: string }>(
        `SELECT count(*)::text AS count FROM information_schema.table_constraints
          WHERE constraint_type = 'FOREIGN KEY'
            AND table_name IN ('intent_deposits','zk_runtime_sessions')`,
      );
      expect(Number(fks.rows[0].count)).toBe(0);
    },
    60_000,
  );

  it("blocks a $2.50 prompt-injection against a $0.10 cap with no deduction", async () => {
    const { id, token } = await insertSession(100_000);
    const request = chatRequest(token, "Audit Kamino vault risks.", {
      "x-simulate-endpoint-cost-micro-usdc": "2500000",
    });
    const res = await chatPOST(request);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe("ERR_SPEND_CAP_EXCEEDED");

    const remaining = await query<{ remaining: string }>(
      "SELECT remaining_micro_usdc::text AS remaining FROM zk_runtime_sessions WHERE id = $1",
      [id],
    );
    expect(Number(remaining.rows[0].remaining)).toBe(100_000_000);
  });
});
