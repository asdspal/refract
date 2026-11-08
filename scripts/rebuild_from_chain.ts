import { createHash } from "node:crypto";
import { Connection, PublicKey } from "@solana/web3.js";
import { closePool, query } from "../src/db/index";

const DEPOSIT_EVENT_DISCRIMINATOR = createHash("sha256")
  .update("event:DepositCommitted")
  .digest()
  .subarray(0, 8);

export interface RebuildOptions {
  connection: Connection;
  vaultPda: PublicKey;
  commitment?: "confirmed" | "finalized";
}

export interface RebuiltLeaf {
  leafIndex: number;
  commitment: string;
  newRoot: string;
  amountMicroUsdc: bigint;
  signature: string;
}

function decodeDepositEvent(
  log: string,
): Omit<RebuiltLeaf, "signature"> | null {
  const prefix = "Program data: ";
  if (!log.startsWith(prefix)) return null;
  const raw = Buffer.from(log.slice(prefix.length), "base64");
  if (raw.length < 8) return null;
  if (!raw.subarray(0, 8).equals(DEPOSIT_EVENT_DISCRIMINATOR)) return null;

  let offset = 8;
  const leafIndex = raw.readUInt32LE(offset);
  offset += 4;
  const commitment = "0x" + raw.subarray(offset, offset + 32).toString("hex");
  offset += 32;
  const newRoot = "0x" + raw.subarray(offset, offset + 32).toString("hex");
  offset += 32;
  const amountMicroUsdc = raw.readBigUInt64LE(offset);
  return { leafIndex, commitment, newRoot, amountMicroUsdc };
}

export async function collectDepositEvents(
  opts: RebuildOptions,
): Promise<RebuiltLeaf[]> {
  const commitment = opts.commitment ?? "confirmed";
  const signatures: string[] = [];
  let before: string | undefined;

  while (true) {
    const page = await opts.connection.getSignaturesForAddress(
      opts.vaultPda,
      { limit: 1000, before },
      commitment,
    );
    signatures.push(...page.map((p) => p.signature));
    if (page.length < 1000) break;
    before = page[page.length - 1].signature;
  }

  const leaves: RebuiltLeaf[] = [];
  for (let i = 0; i < signatures.length; i += 10) {
    const batch = signatures.slice(i, i + 10);
    const txs = await Promise.all(
      batch.map((signature) =>
        opts.connection.getTransaction(signature, {
          commitment,
          maxSupportedTransactionVersion: 0,
        }),
      ),
    );
    for (let j = 0; j < txs.length; j++) {
      const tx = txs[j];
      for (const log of tx?.meta?.logMessages ?? []) {
        const event = decodeDepositEvent(log);
        if (event) leaves.push({ ...event, signature: batch[j] });
      }
    }
  }

  return leaves.sort((a, b) => a.leafIndex - b.leafIndex);
}

/** Rebuild merkle_leaves from Solana DepositCommitted events (RPO = 0). */
export async function rebuildFromChain(
  opts: RebuildOptions,
): Promise<{ count: number; durationMs: number }> {
  const started = performance.now();
  const leaves = await collectDepositEvents(opts);

  for (const leaf of leaves) {
    await query(
      `INSERT INTO merkle_leaves
         (leaf_index, commitment_hex, merkle_root_after_hex, solana_tx_sig)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (leaf_index) DO UPDATE
         SET commitment_hex = EXCLUDED.commitment_hex,
             merkle_root_after_hex = EXCLUDED.merkle_root_after_hex,
             solana_tx_sig = EXCLUDED.solana_tx_sig`,
      [leaf.leafIndex, leaf.commitment, leaf.newRoot, leaf.signature],
    );
  }

  return { count: leaves.length, durationMs: Math.round(performance.now() - started) };
}

async function main() {
  try {
    process.loadEnvFile();
  } catch {
    // .env optional in CI / production
  }

  const rpcUrl =
    process.env.SOLANA_RPC_URL ??
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ??
    "https://api.devnet.solana.com";
  const programId = new PublicKey(
    process.env.NEXT_PUBLIC_REFRACT_VAULT_PROGRAM_ID ??
      "HyeAVxJxt37ndAE2LJBKJ36j8vKLv6PezvwxA2NsmhvH",
  );
  const mint = new PublicKey(
    process.env.NEXT_PUBLIC_SOLANA_USDC_MINT ??
      "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  );
  const [vaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("refract_vault"), mint.toBuffer()],
    programId,
  );

  const connection = new Connection(rpcUrl, "confirmed");
  const { count, durationMs } = await rebuildFromChain({ connection, vaultPda });
  console.log(
    `Rebuilt ${count} Merkle leaves from Solana chain in ${durationMs}ms (RPO=0)`,
  );
  await closePool();
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
