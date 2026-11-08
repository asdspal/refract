/**
 * Devnet end-to-end verification for the SolanaAnchorDepositWorker.
 * Creates a fresh mint + vault, mints test USDC, inserts a pending quote in
 * Postgres, runs the worker with a simulated Aurora SUCCESS, and prints the
 * settlement signature. Costs a small amount of devnet SOL (rent + fees).
 *
 * Run: npx tsx scripts/verify_worker_devnet.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { randomBytes, randomUUID } from "node:crypto";
import { AnchorProvider, Program, Wallet } from "@anchor-lang/core";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import { closePool, query } from "../src/db/index";
import { processPendingDeposits } from "../src/lib/workers/solanaDepositWorker";

const RPC = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_REFRACT_VAULT_PROGRAM_ID ??
    "HyeAVxJxt37ndAE2LJBKJ36j8vKLv6PezvwxA2NsmhvH",
);

function randomFieldHex(): string {
  const buf = randomBytes(32);
  buf[0] &= 0x0f;
  return "0x" + buf.toString("hex");
}

async function main() {
  process.loadEnvFile();
  const rpc = process.env.SOLANA_RPC_URL ?? RPC;
  const connection = new Connection(rpc, "confirmed");
  const secret = JSON.parse(
    readFileSync(join(homedir(), ".config/solana/id.json"), "utf8"),
  );
  const relayer = Keypair.fromSecretKey(Uint8Array.from(secret));
  console.log("relayer", relayer.publicKey.toBase58(), "balance", (await connection.getBalance(relayer.publicKey)) / 1e9, "SOL");

  const provider = new AnchorProvider(connection, new Wallet(relayer), {
    commitment: "confirmed",
  });
  const idl = JSON.parse(readFileSync("target/idl/refract_vault.json", "utf8"));
  const program = new Program(idl, provider);

  const mint = await createMint(connection, relayer, relayer.publicKey, null, 6);
  const [vaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("refract_vault"), mint.toBuffer()],
    PROGRAM_ID,
  );
  const [liquidPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("liquid_vault"), vaultPda.toBuffer()],
    PROGRAM_ID,
  );
  const [defiPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("defi_yield_vault"), vaultPda.toBuffer()],
    PROGRAM_ID,
  );
  console.log("mint", mint.toBase58(), "vault", vaultPda.toBase58());

  await program.methods
    .initializeVault(840)
    .accounts({
      vault: vaultPda,
      usdcMint: mint,
      liquidVault: liquidPda,
      defiYieldVault: defiPda,
      authority: relayer.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: (await import("@solana/web3.js")).SystemProgram.programId,
      rent: (await import("@solana/web3.js")).SYSVAR_RENT_PUBKEY,
    })
    .rpc();

  const ata = await getOrCreateAssociatedTokenAccount(
    connection,
    relayer,
    mint,
    relayer.publicKey,
  );
  await mintTo(connection, relayer, mint, ata.address, relayer.publicKey, 20_000_000);

  await query(
    `UPDATE intent_deposits SET status='EXPIRED'
      WHERE status IN ('QUOTE_CREATED','OPTIMISTIC_CREDITED','PENDING_DEPOSIT')`,
  );
  await query("TRUNCATE TABLE merkle_leaves");
  const quoteId = `devnet_worker_${randomUUID()}`;
  const commitmentHex = randomFieldHex();
  await query(
    `INSERT INTO intent_deposits
       (aurora_quote_id, origin_chain, origin_asset, origin_amount_raw,
        expected_solana_micro_usdc, deposit_address, refund_address,
        confidential_mode, integrator_fee_bps, poseidon_commitment_hex, status)
     VALUES ($1,'base',$2,'10000000',10000000,$3,$4,TRUE,30,$5,'QUOTE_CREATED')`,
    [
      quoteId,
      "nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near",
      "0x" + randomBytes(20).toString("hex"),
      "0x71C95911E9a5D330f4D621842EC243EE1343292e",
      commitmentHex,
    ],
  );

  const results = await processPendingDeposits({
    connection,
    program,
    relayer,
    usdcMint: mint,
    depositorUsdc: ata.address,
    getStatus: async () => ({ status: "SUCCESS", amountOut: "10000000" }),
  });
  console.log("worker results", JSON.stringify(results, null, 2));

  const leaves = await query(
    "SELECT leaf_index, commitment_hex, merkle_root_after_hex FROM merkle_leaves ORDER BY leaf_index",
  );
  console.log("merkle_leaves", leaves.rows);
  const vault: any = await (program.account as any).zkYieldVault.fetch(vaultPda);
  console.log("vault nextLeafIndex", vault.nextLeafIndex, "root index", vault.currentRootIndex);

  const result = results.find((r) => r.quoteId === quoteId);
  if (result?.status === "SETTLED") {
    console.log(
      `DEVNET SETTLED: https://explorer.solana.com/tx/${result.signature}?cluster=devnet`,
    );
  }
  await query("DELETE FROM intent_deposits WHERE aurora_quote_id = $1", [quoteId]);
  await closePool();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
