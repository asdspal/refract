import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { query, closePool } from "../../src/db/index";
import {
  authorizeAndDeductRuntimeKey,
  hashRuntimeKey,
  SpendPolicyError,
} from "../../src/lib/x402/runtimeKeyMeter";

const root = resolve(__dirname, "../..");
const upSql = readFileSync(
  resolve(root, "src/db/migrations/0001_init_refract_schema.up.sql"),
  "utf8",
);
const downSql = readFileSync(
  resolve(root, "src/db/migrations/0001_init_refract_schema.down.sql"),
  "utf8",
);

function hex64(): string {
  return "0x" + randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "").slice(0, 32).padEnd(32, "0");
}

async function insertSession(opts: {
  remaining: number;
  maxPerRequest: number;
  dailyCap?: number;
}): Promise<{ id: string; token: string }> {
  const token = `rk_live_test_${randomUUID()}`;
  const res = await query<{ id: string }>(
    `INSERT INTO zk_runtime_sessions
       (nullifier_hash_hex, merkle_root_used_hex, runtime_key_hash,
        principal_micro_usdc, remaining_micro_usdc,
        max_per_request_micro_usdc, daily_cap_micro_usdc)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      hex64(),
      hex64(),
      hashRuntimeKey(token),
      opts.remaining,
      opts.remaining,
      opts.maxPerRequest,
      opts.dailyCap ?? 2_000_000,
    ],
  );
  return { id: res.rows[0].id, token };
}

const EXPECTED_INDEXES = [
  "idx_intent_deposits_status_created",
  "idx_intent_deposits_commitment",
  "idx_merkle_leaves_root",
  "idx_merkle_leaves_commitment",
  "idx_zk_runtime_sessions_key_active",
  "idx_x402_receipts_session_created",
  "idx_x402_receipts_merchant_created",
  "idx_defi_snapshots_recorded",
];

beforeAll(async () => {
  await query(downSql);
  await query(upSql);
});

afterAll(async () => {
  await closePool();
});

describe("schema migration", () => {
  it("creates all 6 tables", async () => {
    const res = await query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
    );
    const names = res.rows.map((r) => r.table_name);
    expect(names).toEqual(
      expect.arrayContaining([
        "intent_deposits",
        "merkle_leaves",
        "zk_runtime_sessions",
        "x402_merchants",
        "x402_usage_receipts",
        "defi_vault_snapshots",
      ]),
    );
  });

  it("creates all 8 named indexes", async () => {
    const res = await query<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes WHERE schemaname = 'public'`,
    );
    const names = res.rows.map((r) => r.indexname);
    for (const idx of EXPECTED_INDEXES) {
      expect(names, `missing index ${idx}`).toContain(idx);
    }
  });

  it("has zero foreign key link between deposits and sessions (SEC-04)", async () => {
    const res = await query<{ count: string }>(
      `SELECT count(*)::text AS count
         FROM information_schema.table_constraints
        WHERE constraint_type = 'FOREIGN KEY'
          AND table_name IN ('intent_deposits', 'zk_runtime_sessions')`,
    );
    expect(Number(res.rows[0].count)).toBe(0);
  });

  it("seeds 2 merchants and 1 vault snapshot", async () => {
    const merchants = await query<{ count: string }>(
      "SELECT count(*)::text AS count FROM x402_merchants",
    );
    const snapshots = await query<{ count: string }>(
      "SELECT count(*)::text AS count FROM defi_vault_snapshots",
    );
    expect(Number(merchants.rows[0].count)).toBe(2);
    expect(Number(snapshots.rows[0].count)).toBeGreaterThanOrEqual(1);
  });
});

describe("atomic runtime-key meter", () => {
  it("allows exactly 3 of 10 concurrent $0.04 calls against $0.12", async () => {
    const { id, token } = await insertSession({
      remaining: 120_000,
      maxPerRequest: 100_000,
    });

    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () =>
        authorizeAndDeductRuntimeKey(token, 40_000),
      ),
    );

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(3);
    expect(rejected).toHaveLength(7);
    for (const r of rejected) {
      const err = (r as PromiseRejectedResult).reason;
      expect(err).toBeInstanceOf(SpendPolicyError);
      expect((err as SpendPolicyError).code).toBe("ERR_INSUFFICIENT_NOTE_BALANCE");
    }

    const res = await query<{ remaining: string }>(
      "SELECT remaining_micro_usdc::text AS remaining FROM zk_runtime_sessions WHERE id = $1",
      [id],
    );
    expect(Number(res.rows[0].remaining)).toBe(0);
  });

  it("blocks a $2.50 request against a $0.10 per-request cap and deducts nothing", async () => {
    const { id, token } = await insertSession({
      remaining: 10_000_000,
      maxPerRequest: 100_000,
    });

    await expect(
      authorizeAndDeductRuntimeKey(token, 2_500_000),
    ).rejects.toMatchObject({ code: "ERR_SPEND_CAP_EXCEEDED" });

    const res = await query<{ remaining: string }>(
      "SELECT remaining_micro_usdc::text AS remaining FROM zk_runtime_sessions WHERE id = $1",
      [id],
    );
    expect(Number(res.rows[0].remaining)).toBe(10_000_000);
  });

  it("rejects unknown runtime keys", async () => {
    await expect(
      authorizeAndDeductRuntimeKey(`rk_live_unknown_${randomUUID()}`, 15_000),
    ).rejects.toMatchObject({ code: "ERR_INVALID_RUNTIME_KEY" });
  });
});
