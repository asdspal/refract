import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { query, closePool } from "../../src/db/index";
import { GET as healthGET } from "../../src/app/api/v1/health/route";
import { GET as vaultStatsGET } from "../../src/app/api/v1/defi/vault-stats/route";

const root = resolve(__dirname, "../..");

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
     VALUES (25000000, 22500000, 2500000, 0, 940, 840, 123456789)`,
  );
});

afterAll(async () => {
  await closePool();
});

describe("GET /api/v1/health", () => {
  it("returns ok with correlation id", async () => {
    const res = await healthGET();
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Correlation-Id")).toMatch(/^req_/);
    const body = await res.json();
    expect(body.postgres).toBe("ok");
    expect(body.status).toBe("ok");
    expect(typeof body.solanaNetwork).toBe("string");
  });
});

describe("GET /api/v1/defi/vault-stats", () => {
  it("returns the latest 90/10 DeFi snapshot", async () => {
    const res = await vaultStatsGET();
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Correlation-Id")).toMatch(/^req_/);
    const body = await res.json();
    expect(body.totalPoolMicroUsdc).toBe(25000000);
    expect(body.kaminoStakedMicroUsdc).toBe(22500000);
    expect(body.liquidReserveMicroUsdc).toBe(2500000);
    expect(body.currentApyBps).toBe(940);
    expect(body.subsidyBonusBps).toBe(840);
    expect(body.kaminoStakedMicroUsdc / body.totalPoolMicroUsdc).toBeCloseTo(0.9, 5);
  });
});
