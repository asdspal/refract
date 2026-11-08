import { checkPostgres } from "@/db/index";
import { jsonResponse } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const pg = await checkPostgres();
  return jsonResponse({
    status: pg.ok ? "ok" : "degraded",
    postgres: pg.ok ? "ok" : "down",
    postgresLatencyMs: pg.latencyMs,
    solanaNetwork: process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? "devnet",
    auroraOneClickReachable: Boolean(process.env.AURORA_ONE_CLICK_BASE_URL),
  });
}
