/**
 * Devnet verification for POST /api/v1/zkapi/runtime-key:
 * deposits a local note, generates a real Groth16 proof, verifies it on the
 * devnet RefractVault, and mints a runtime key. Costs a small amount of SOL.
 *
 * Run: npx tsx scripts/verify_runtime_key_devnet.ts
 */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import { AnchorProvider, BN, Program, Wallet } from "@anchor-lang/core";
import { Connection, Keypair, PublicKey, SYSVAR_RENT_PUBKEY, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, createMint, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import { closePool, query } from "../src/db/index";
import { generateLocalZkNote } from "../src/lib/zkapi/clientNoteVault";
import { proveNoteSpend } from "../src/lib/zkapi/proverClient";
import { mintRuntimeKey } from "../src/lib/zkapi/solanaVerifier";

async function main() {
  process.loadEnvFile();
  const root = resolve(__dirname, "..");
  const rpc = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
  const connection = new Connection(rpc, "confirmed");
  const relayer = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(readFileSync(join(homedir(), ".config/solana/id.json"), "utf8"))),
  );
  console.log("relayer", relayer.publicKey.toBase58(), "balance", (await connection.getBalance(relayer.publicKey)) / 1e9, "SOL");
  const provider = new AnchorProvider(connection, new Wallet(relayer), { commitment: "confirmed" });
  const idl = JSON.parse(readFileSync(join(root, "target/idl/refract_vault.json"), "utf8"));
  const program = new Program(idl, provider);
  const programId = program.programId;

  const mint = await createMint(connection, relayer, relayer.publicKey, null, 6);
  const [vaultPda] = PublicKey.findProgramAddressSync([Buffer.from("refract_vault"), mint.toBuffer()], programId);
  const [liquidPda] = PublicKey.findProgramAddressSync([Buffer.from("liquid_vault"), vaultPda.toBuffer()], programId);
  const [defiPda] = PublicKey.findProgramAddressSync([Buffer.from("defi_yield_vault"), vaultPda.toBuffer()], programId);
  console.log("mint", mint.toBase58(), "vault", vaultPda.toBase58());

  await program.methods.initializeVault(840).accounts({
    vault: vaultPda, usdcMint: mint, liquidVault: liquidPda, defiYieldVault: defiPda,
    authority: relayer.publicKey, tokenProgram: TOKEN_PROGRAM_ID,
    systemProgram: SystemProgram.programId, rent: SYSVAR_RENT_PUBKEY,
  }).rpc();

  const ata = await getOrCreateAssociatedTokenAccount(connection, relayer, mint, relayer.publicKey);
  await mintTo(connection, relayer, mint, ata.address, relayer.publicKey, 20_000_000);

  const note = await generateLocalZkNote(10_000_000n);
  await program.methods.depositAndCommit(
    Array.from(Buffer.from(note.commitmentHex.slice(2), "hex")),
    new BN("10000000"),
  ).accounts({
    vault: vaultPda, liquidVault: liquidPda, usdcMint: mint,
    depositorUsdc: ata.address, depositor: relayer.publicKey, tokenProgram: TOKEN_PROGRAM_ID,
  }).rpc();

  const proof = await proveNoteSpend({
    note, leavesHex: [note.commitmentHex], leafIndex: 0, spendCapMicroUsdc: 10_000_000n,
    wasmPath: join(root, "public/circuits/refract_note_spend.wasm"),
    zkeyPath: join(root, "public/circuits/refract_note_spend_final.zkey"),
  });
  console.log(`proof generated in ${proof.durationMs.toFixed(0)}ms`);

  await query(
    `INSERT INTO defi_vault_snapshots
       (total_pool_micro_usdc, kamino_staked_micro_usdc, liquid_reserve_micro_usdc,
        optimistic_utilized_micro_usdc, current_apy_bps, subsidy_bonus_bps, solana_slot)
     VALUES (20000000, 18000000, 2000000, 0, 940, 840, 555555)`,
  );

  const result = await mintRuntimeKey(
    {
      proofHex: proof.proofHex,
      merkleRootHex: proof.merkleRootHex,
      nullifierHashHex: proof.nullifierHashHex,
      spendCapMicroUsdc: 10_000_000,
      sessionPubkeyHashHex: proof.sessionPubkeyHashHex,
    },
    { connection, program, relayer, usdcMint: mint },
  );
  console.log(JSON.stringify(result, null, 2));
  console.log(`DEVNET RUNTIME KEY: https://explorer.solana.com/tx/${result.solanaVerifyTxSig}?cluster=devnet`);
  await query("DELETE FROM defi_vault_snapshots WHERE solana_slot = 555555");
  await closePool();
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
