import { query } from "@/db/index";
import { jsonResponse } from "@/lib/http";
import { getRedis } from "@/lib/x402/runtimeKeyMeter";
import { buildMerkleTree } from "@/lib/zkapi/merkleTree";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CACHE_KEY = "refract:merkle:tree";
let emptyRootHexCache: string | null = null;

async function emptyRootHex(): Promise<string> {
  if (!emptyRootHexCache) {
    const tree = await buildMerkleTree([]);
    emptyRootHexCache = "0x" + tree.root.toString(16).padStart(64, "0");
  }
  return emptyRootHexCache;
}

interface LeafRow {
  leaf_index: number;
  commitment_hex: string;
  merkle_root_after_hex: string;
  solana_tx_sig: string | null;
}

export interface MerkleTreeResponse {
  currentRootHex: string;
  nextLeafIndex: number;
  leaves: Array<{
    leafIndex: number;
    commitmentHex: string;
    rootAfterHex: string;
    solanaTxSig: string | null;
  }>;
}

export async function GET() {
  const redis = getRedis();
  if (redis) {
    const cached = await redis
      .get<MerkleTreeResponse>(CACHE_KEY)
      .catch(() => null);
    if (cached) return jsonResponse(cached);
  }

  const res = await query<LeafRow>(
    `SELECT leaf_index, commitment_hex, merkle_root_after_hex, solana_tx_sig
       FROM merkle_leaves
      ORDER BY leaf_index ASC`,
  );

  const leaves = res.rows.map((row) => ({
    leafIndex: row.leaf_index,
    commitmentHex: row.commitment_hex,
    rootAfterHex: row.merkle_root_after_hex,
    solanaTxSig: row.solana_tx_sig,
  }));

  const payload: MerkleTreeResponse = {
    currentRootHex:
      leaves.length > 0 ? leaves[leaves.length - 1].rootAfterHex : await emptyRootHex(),
    nextLeafIndex:
      leaves.length > 0 ? leaves[leaves.length - 1].leafIndex + 1 : 0,
    leaves,
  };

  if (redis) {
    await redis.set(CACHE_KEY, payload, { ex: 60 }).catch(() => undefined);
  }
  return jsonResponse(payload);
}
