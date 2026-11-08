import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { query, closePool } from "../../src/db/index";
import {
  authorizeAndDeductRuntimeKey,
  rollbackRuntimeKeyCharge,
  getRedis,
  hashRuntimeKey,
  SpendPolicyError,
} from "../../src/lib/x402/runtimeKeyMeter";

const root = resolve(__dirname, "../..");
const upSql = readFileSync(
  resolve(root, "src/db/migrations/0001_init_refract_schema.up.sql"),
  "utf8",
);

function hex64(): string {
  return (
    "0x" +
    randomUUID().replace(/-/g, "") +
    randomUUID().replace(/-/g, "").slice(0, 32).padEnd(32, "0")
  );
}

async function insertSession(opts: {
  remaining: number;
  maxPerRequest: number;
  dailyCap?: number;
}): Promise<{ id: string; token: string; hash: string }> {
  const token = `rk_live_test_${randomUUID()}`;
  const hash = hashRuntimeKey(token);
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
      hash,
      opts.remaining,
      opts.remaining,
      opts.maxPerRequest,
      opts.dailyCap ?? 2_000_000,
    ],
  );
  return { id: res.rows[0].id, token, hash };
}

async function pgRemaining(id: string): Promise<number> {
  const res = await query<{ remaining: string }>(
    "SELECT remaining_micro_usdc::text AS remaining FROM zk_runtime_sessions WHERE id = $1",
    [id],
  );
  return Number(res.rows[0].remaining);
}

const redis = getRedis();
const describeRedis = redis ? describe : describe.skip;

beforeAll(async () => {
  await query(upSql);
});

afterAll(async () => {
  await closePool();
});

describeRedis("Upstash Redis fast path", () => {
  it("deducts atomically in Redis and writes through to Postgres", async () => {
    const { id, token, hash } = await insertSession({
      remaining: 1_000_000,
      maxPerRequest: 100_000,
    });

    const auth = await authorizeAndDeductRuntimeKey(token, 15_000);
    expect(auth.source).toBe("redis");
    expect(auth.remainingMicroUsdc).toBe(985_000);
    expect(auth.chargedMicroUsdc).toBe(15_000);

    const cached = await redis!.hget<number>(`refract:rk:${hash}`, "remaining");
    expect(Number(cached)).toBe(985_000);
    expect(await pgRemaining(id)).toBe(985_000);

    await redis!.del(`refract:rk:${hash}`);
  });

  it("allows exactly 3 of 10 concurrent $0.04 calls against $0.12", async () => {
    const { id, token, hash } = await insertSession({
      remaining: 120_000,
      maxPerRequest: 40_000,
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
    for (const r of fulfilled) {
      expect((r as PromiseFulfilledResult<{ source: string }>).value.source).toBe("redis");
    }
    expect(await pgRemaining(id)).toBe(0);
    expect(Number(await redis!.hget<number>(`refract:rk:${hash}`, "remaining"))).toBe(0);

    await redis!.del(`refract:rk:${hash}`);
  });

  it("rolls back a charge in both Redis and Postgres", async () => {
    const { id, token, hash } = await insertSession({
      remaining: 500_000,
      maxPerRequest: 100_000,
    });

    const auth = await authorizeAndDeductRuntimeKey(token, 20_000);
    await rollbackRuntimeKeyCharge(auth.sessionId, 20_000);

    expect(await pgRemaining(id)).toBe(500_000);
    expect(Number(await redis!.hget<number>(`refract:rk:${hash}`, "remaining"))).toBe(500_000);

    const after = await authorizeAndDeductRuntimeKey(token, 20_000);
    expect(after.remainingMicroUsdc).toBe(480_000);

    await redis!.del(`refract:rk:${hash}`);
  });

  it("still works through the Postgres fallback path", async () => {
    const { id, token, hash } = await insertSession({
      remaining: 300_000,
      maxPerRequest: 100_000,
    });

    const auth = await authorizeAndDeductRuntimeKey(token, 50_000, {
      forcePostgres: true,
    });
    expect(auth.source).toBe("postgres");
    expect(await pgRemaining(id)).toBe(250_000);

    await redis!.del(`refract:rk:${hash}`);
  });

  it("blocks an over-cap request without deducting in either store", async () => {
    const { id, token, hash } = await insertSession({
      remaining: 10_000_000,
      maxPerRequest: 100_000,
    });

    await expect(
      authorizeAndDeductRuntimeKey(token, 2_500_000),
    ).rejects.toMatchObject({ code: "ERR_SPEND_CAP_EXCEEDED" });

    expect(await pgRemaining(id)).toBe(10_000_000);
    expect(Number(await redis!.hget<number>(`refract:rk:${hash}`, "remaining"))).toBe(10_000_000);

    await redis!.del(`refract:rk:${hash}`);
  });

  it("measures p95 latency over 50 sequential deductions", async () => {
    const { id, token, hash } = await insertSession({
      remaining: 100_000_000,
      maxPerRequest: 100_000,
      dailyCap: 100_000_000,
    });

    const latencies: number[] = [];
    for (let i = 0; i < 50; i++) {
      const started = performance.now();
      await authorizeAndDeductRuntimeKey(token, 1_000);
      latencies.push(performance.now() - started);
    }
    latencies.sort((a, b) => a - b);
    const p50 = latencies[Math.floor(latencies.length * 0.5)];
    const p95 = latencies[Math.floor(latencies.length * 0.95)];
    console.log(
      `meter latency (local -> Upstash -> Postgres): p50=${p50.toFixed(1)}ms p95=${p95.toFixed(1)}ms`,
    );
    expect(await pgRemaining(id)).toBe(100_000_000 - 50_000);
    expect(p95).toBeLessThan(1000);

    await redis!.del(`refract:rk:${hash}`);
  });

  it("rejects unknown runtime keys", async () => {
    await expect(
      authorizeAndDeductRuntimeKey(`rk_live_unknown_${randomUUID()}`, 1_000),
    ).rejects.toBeInstanceOf(SpendPolicyError);
  });
});
