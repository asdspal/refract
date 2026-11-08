/**
 * Initialize and seed the RefractVault on a cluster.
 *
 * Devnet (default): creates a fresh test mint, initializes the vault, mints
 * 20 USDC, deposits it, and rebalances 90/10.
 * Mainnet: uses NEXT_PUBLIC_SOLANA_USDC_MINT (canonical USDC) and deposits
 * from the operator wallet; requires a funded wallet.
 *
 * Run: npx tsx scripts/deploy_and_seed_vault.ts [--cluster devnet|mainnet]
 */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import { randomBytes } from "node:crypto";
import { AnchorProvider, BN, Program, Wallet } from "@anchor-lang/core";
import {
  Connection,
  Keypair,
  PublicKey,
  SYSVAR_RENT_PUBKEY,
  SystemProgram,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createMint,
  getAccount,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import { closePool } from "../src/db/index";

const SEED_AMOUNT = 20_000_000n; // $20.00

function clusterArg(): "devnet" | "mainnet" {
  const index = process.argv.indexOf("--cluster");
  return index >= 0 && process.argv[index + 1] === "mainnet"
    ? "mainnet"
    : "devnet";
}

function randomFieldHex(): string {
  const buf = randomBytes(32);
  buf[0] &= 0x0f;
  return "0x" + buf.toString("hex");
}

async function main() {
  process.loadEnvFile();
  const cluster = clusterArg();
  const root = resolve(__dirname, "..");
  const rpc =
    cluster === "mainnet"
      ? process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com"
      : "https://api.devnet.solana.com";
  const connection = new Connection(rpc, "confirmed");
  const relayer = Keypair.fromSecretKey(
    Uint8Array.from(
      JSON.parse(readFileSync(join(homedir(), ".config/solana/id.json"), "utf8")),
    ),
  );
  console.log(`cluster=${cluster} relayer=${relayer.publicKey.toBase58()} balance=${(await connection.getBalance(relayer.publicKey)) / 1e9} SOL`);

  const provider = new AnchorProvider(connection, new Wallet(relayer), {
    commitment: "confirmed",
  });
  const idl = JSON.parse(
    readFileSync(join(root, "target/idl/refract_vault.json"), "utf8"),
  );
  const program = new Program(idl, provider);
  const programId = program.programId;

  const mint =
    cluster === "mainnet"
      ? new PublicKey(
          process.env.NEXT_PUBLIC_SOLANA_USDC_MINT ??
            "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        )
      : await createMint(connection, relayer, relayer.publicKey, null, 6);

  const [vaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("refract_vault"), mint.toBuffer()],
    programId,
  );
  const [liquidPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("liquid_vault"), vaultPda.toBuffer()],
    programId,
  );
  const [defiPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("defi_yield_vault"), vaultPda.toBuffer()],
    programId,
  );

  const existing = await connection.getAccountInfo(vaultPda);
  if (!existing) {
    await program.methods
      .initializeVault(840)
      .accounts({
        vault: vaultPda,
        usdcMint: mint,
        liquidVault: liquidPda,
        defiYieldVault: defiPda,
        authority: relayer.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .rpc();
    console.log("initialize_vault: ok");
  } else {
    console.log("vault already initialized");
  }

  const ata = await getOrCreateAssociatedTokenAccount(
    connection,
    relayer,
    mint,
    relayer.publicKey,
  );
  if (cluster === "devnet") {
    await mintTo(connection, relayer, mint, ata.address, relayer.publicKey, SEED_AMOUNT);
  }
  const balance = await getAccount(connection, ata.address);
  if (balance.amount < SEED_AMOUNT) {
    throw new Error(
      `Wallet token balance ${balance.amount} < seed ${SEED_AMOUNT}; fund the wallet first.`,
    );
  }

  const deposit = await program.methods
    .depositAndCommit(
      Array.from(Buffer.from(randomFieldHex().slice(2), "hex")),
      new BN(SEED_AMOUNT.toString()),
    )
    .accounts({
      vault: vaultPda,
      liquidVault: liquidPda,
      usdcMint: mint,
      depositorUsdc: ata.address,
      depositor: relayer.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();

  const rebalance = await program.methods
    .rebalanceDefiFloat()
    .accounts({
      vault: vaultPda,
      usdcMint: mint,
      liquidVault: liquidPda,
      defiYieldVault: defiPda,
      authority: relayer.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();

  const liquid = await getAccount(connection, liquidPda);
  const staked = await getAccount(connection, defiPda);
  console.log(`\nVAULT_PDA=${vaultPda.toBase58()}`);
  console.log(`LIQUID_VAULT=${liquidPda.toBase58()} (${Number(liquid.amount) / 1e6} USDC)`);
  console.log(`DEFI_VAULT=${defiPda.toBase58()} (${Number(staked.amount) / 1e6} USDC)`);
  console.log(`DEPOSIT_TX=https://explorer.solana.com/tx/${deposit}?cluster=${cluster}`);
  console.log(`REBALANCE_TX=https://explorer.solana.com/tx/${rebalance}?cluster=${cluster}`);
  await closePool();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
