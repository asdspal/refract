import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { closePool, query } from "../../src/db/index";
import {
  OptimisticCreditError,
  issueOptimisticCredit,
  optimisticNullifierHash,
  revokeOptimisticCreditOnFailure,
} from "../../src/lib/defi/optimisticCreditEngine";
import { authorizeAndDeductRuntimeKey } from "../../src/lib/x402/runtimeKeyMeter";
import { POST as optimisticPOST } from "../../src/app/api/v1/intents/optimistic-credit/route";

const root = resolve(__dirname, "../..");
const quoteIds: string[] = [];

function commitHex(): string {
  return "0x" + randomBytes(32).toString("hex");
}

async function insertQuote(expectedMicroUsdc: number): Promise<string> {
  const quoteId = `test_opt_${randomUUID()}`;
  quoteIds.push(quoteId);
  await query(
    `INSERT INTO intent_deposits
       (aurora_quote_id, origin_chain, origin_asset, origin_amount_raw,
        expected_solana_micro_usdc, deposit_address, refund_address,
        confidential_mode, integrator_fee_bps, poseidon_commitment_hex, status)
     VALUES ($1,'base',$2,'10000000',$3,$4,$5,true,30,$6,'QUOTE_CREATED')`,
    [
      quoteId,
      "nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near",
      expectedMicroUsdc,
      "0x" + randomBytes(20).toString("hex"),
      "0x71C95911E9a5D330f4D621842EC243EE1343292e",
      commitHex(),
    ],
  );
  return quoteId;
}

beforeAll(async () => {
  const upSql = readFileSync(
    resolve(root, "src/db/migrations/0001_init_refract_schema.up.sql"),
    "utf8",
  );
  await query(upSql);
  await query(
    `INSERT INTO defi_vault_snapshots
       (total_pool_micro_usdc, kamino_staked_micro_usdc, liquid_reserve_micro_usdc,
        optimistic_utilized_micro_usdc, current_apy_bps, subsidy_bonus_bps, solana_slot)
     VALUES (25000000, 22500000, 25000000, 0, 940, 840, 111111)`,
  );
});

afterAll(async () => {
  if (quoteIds.length > 0) {
    const nullifiers = quoteIds.map(optimisticNullifierHash);
    await query("DELETE FROM zk_runtime_sessions WHERE nullifier_hash_hex = ANY($1)", [
      nullifiers,
    ]);
    await query("DELETE FROM intent_deposits WHERE aurora_quote_id = ANY($1)", [
      quoteIds,
    ]);
  }
  await query("DELETE FROM defi_vault_snapshots WHERE solana_slot IN (111111, 222222)");
  await closePool();
});

describe("optimistic float credit", () => {
  let quoteId: string;
  let runtimeKey: string;

  it("issues a $5.00-capped key with +8.4% bonus in <= 400ms", async () => {
    quoteId = await insertQuote(10_000_000);
    const result = await issueOptimisticCredit({
      auroraQuoteId: quoteId,
      originTxHash: "0x" + randomBytes(32).toString("hex"),
    });

    runtimeKey = result.runtimeKey;
    expect(result.runtimeKey).toMatch(/^rk_live_opt_[0-9a-f]{64}$/);
    expect(result.optimisticCreditMicroUsdc).toBe(5_000_000);
    expect(result.yieldSubsidyBonusMicroUsdc).toBe(420_000);
    expect(result.latencyMs).toBeLessThanOrEqual(400);

    const deposit = await query<{ status: string; issued: boolean }>(
      "SELECT status, optimistic_credit_issued AS issued FROM intent_deposits WHERE aurora_quote_id = $1",
      [quoteId],
    );
    expect(deposit.rows[0].status).toBe("OPTIMISTIC_CREDITED");
    expect(deposit.rows[0].issued).toBe(true);

    const session = await query<{
      principal: string;
      bonus: string;
      remaining: string;
      is_optimistic: boolean;
      status: string;
    }>(
      `SELECT principal_micro_usdc::text AS principal, yield_subsidy_micro_usdc::text AS bonus,
              remaining_micro_usdc::text AS remaining, is_optimistic, status
         FROM zk_runtime_sessions WHERE nullifier_hash_hex = $1`,
      [optimisticNullifierHash(quoteId)],
    );
    expect(session.rows[0].principal).toBe("5000000");
    expect(session.rows[0].bonus).toBe("420000");
    expect(session.rows[0].remaining).toBe("5420000");
    expect(session.rows[0].is_optimistic).toBe(true);
    expect(session.rows[0].status).toBe("ACTIVE");

    // The key is immediately spendable by the x402 meter.
    const spend = await authorizeAndDeductRuntimeKey(runtimeKey, 15_000);
    expect(spend.remainingMicroUsdc).toBe(5_405_000);
  }, 60_000);

  it("rejects a duplicate optimistic credit request with 409", async () => {
    await expect(
      issueOptimisticCredit({
        auroraQuoteId: quoteId,
        originTxHash: "0x" + randomBytes(32).toString("hex"),
      }),
    ).rejects.toMatchObject({ code: "ERR_OPTIMISTIC_ALREADY_ISSUED", status: 409 });
  });

  it("revokes the session on refund and blocks further spending (SEC-02)", async () => {
    const result = await revokeOptimisticCreditOnFailure(quoteId, "REFUNDED");
    expect(result.revoked).toBe(true);

    const deposit = await query<{ status: string }>(
      "SELECT status FROM intent_deposits WHERE aurora_quote_id = $1",
      [quoteId],
    );
    expect(deposit.rows[0].status).toBe("REFUNDED");

    await expect(
      authorizeAndDeductRuntimeKey(runtimeKey, 1_000),
    ).rejects.toMatchObject({ code: "ERR_OPTIMISTIC_SESSION_REVOKED" });
  }, 60_000);

  it("trips the 80% liquid reserve circuit breaker", async () => {
    await query(
      `INSERT INTO defi_vault_snapshots
         (total_pool_micro_usdc, kamino_staked_micro_usdc, liquid_reserve_micro_usdc,
          optimistic_utilized_micro_usdc, current_apy_bps, subsidy_bonus_bps, solana_slot, recorded_at)
       VALUES (1000000, 0, 1000000, 0, 940, 840, 222222, now() + interval '1 second')`,
    );
    const quote = await insertQuote(10_000_000);
    await expect(
      issueOptimisticCredit({
        auroraQuoteId: quote,
        originTxHash: "0x" + randomBytes(32).toString("hex"),
      }),
    ).rejects.toBeInstanceOf(OptimisticCreditError);

    // Restore a healthy reserve for the remaining tests.
    await query("DELETE FROM defi_vault_snapshots WHERE solana_slot = 222222");
    await query(
      `INSERT INTO defi_vault_snapshots
         (total_pool_micro_usdc, kamino_staked_micro_usdc, liquid_reserve_micro_usdc,
          optimistic_utilized_micro_usdc, current_apy_bps, subsidy_bonus_bps, solana_slot, recorded_at)
       VALUES (25000000, 22500000, 25000000, 0, 940, 840, 111111, now() + interval '2 second')`,
    );
  }, 60_000);

  it("route returns 200 with the issued key", async () => {
    const quote = await insertQuote(3_000_000);
    const res = await optimisticPOST(
      new Request("http://localhost/api/v1/intents/optimistic-credit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          auroraQuoteId: quote,
          originTxHash: "0x" + randomBytes(32).toString("hex"),
        }),
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Correlation-Id")).toMatch(/^req_/);
    const body = await res.json();
    expect(body.runtimeKey).toMatch(/^rk_live_opt_/);
    expect(body.optimisticCreditMicroUsdc).toBe(3_000_000);
    expect(body.yieldSubsidyBonusMicroUsdc).toBe(252_000);
  }, 60_000);
});
