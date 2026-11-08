import { query } from "@/db/index";
import { jsonResponse } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface VaultSnapshotRow {
  total_pool_micro_usdc: string;
  kamino_staked_micro_usdc: string;
  liquid_reserve_micro_usdc: string;
  optimistic_utilized_micro_usdc: string;
  current_apy_bps: number;
  subsidy_bonus_bps: number;
  solana_slot: string | null;
  recorded_at: string;
}

export async function GET() {
  const res = await query<VaultSnapshotRow>(
    `SELECT total_pool_micro_usdc::text,
            kamino_staked_micro_usdc::text,
            liquid_reserve_micro_usdc::text,
            optimistic_utilized_micro_usdc::text,
            current_apy_bps,
            subsidy_bonus_bps,
            solana_slot::text,
            recorded_at
       FROM defi_vault_snapshots
      ORDER BY recorded_at DESC
      LIMIT 1`,
  );

  const row = res.rows[0];
  if (!row) {
    return jsonResponse(
      {
        code: "ERR_VAULT_SNAPSHOT_MISSING",
        message: "No DeFi vault snapshot is available yet.",
      },
      { status: 503 },
    );
  }

  return jsonResponse({
    totalPoolMicroUsdc: Number(row.total_pool_micro_usdc),
    kaminoStakedMicroUsdc: Number(row.kamino_staked_micro_usdc),
    liquidReserveMicroUsdc: Number(row.liquid_reserve_micro_usdc),
    optimisticUtilizedMicroUsdc: Number(row.optimistic_utilized_micro_usdc),
    currentApyBps: row.current_apy_bps,
    subsidyBonusBps: row.subsidy_bonus_bps,
    solanaSlot: row.solana_slot === null ? null : Number(row.solana_slot),
    recordedAt: row.recorded_at,
  });
}
