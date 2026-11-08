import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BN } from "@anchor-lang/core";
import {
  TOKEN_PROGRAM_ID,
  createMint,
  getAccount,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import { PublicKey, SYSVAR_RENT_PUBKEY, SystemProgram } from "@solana/web3.js";
import {
  chainPrerequisitesAvailable,
  startChain,
  type LocalChain,
} from "./helpers";
import { buildMerkleTree } from "../../src/lib/zkapi/merkleTree";

const describeChain = chainPrerequisitesAvailable() ? describe : describe.skip;

const DEPTH = 20;
const FIRST_DEPOSIT = 10_000_000n; // $10.00
const SECOND_DEPOSIT = 5_000_000n; // $5.00

function fieldBytes(value: bigint): number[] {
  return Array.from(Buffer.from(value.toString(16).padStart(64, "0"), "hex"));
}

function rootBytesToHex(bytes: number[]): string {
  return "0x" + Buffer.from(bytes).toString("hex");
}

describeChain("ZkYieldVault + depth-20 Poseidon Merkle tree", () => {
  let chain: LocalChain;
  let mint: PublicKey;
  let vaultPda: PublicKey;
  let liquidPda: PublicKey;

  beforeAll(async () => {
    chain = await startChain(18900);
    const { connection, payer, program, programId } = chain;

    mint = await createMint(connection, payer, payer.publicKey, null, 6);
    [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("refract_vault"), mint.toBuffer()],
      programId,
    );
    [liquidPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("liquid_vault"), vaultPda.toBuffer()],
      programId,
    );

    await program.methods
      .initializeVault(840)
      .accounts({
        vault: vaultPda,
        usdcMint: mint,
        liquidVault: liquidPda,
        authority: payer.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    const ata = await getOrCreateAssociatedTokenAccount(connection, payer, mint, payer.publicKey);
    await mintTo(connection, payer, mint, ata.address, payer.publicKey, 100_000_000);
  }, 240_000);

  afterAll(() => chain?.stop());

  it("initializes the vault with the empty-tree root in history", async () => {
    const vault: any = await (chain.program.account as any).zkYieldVault.fetch(vaultPda);
    expect(vault.nextLeafIndex).toBe(0);
    expect(vault.currentRootIndex).toBe(1);
    expect(vault.subsidyBonusBps).toBe(840);
    const empty = await buildMerkleTree([]);
    expect(rootBytesToHex(vault.rootHistory[0])).toBe(
      "0x" + empty.root.toString(16).padStart(64, "0"),
    );
  });

  it("deposits USDC and commits a leaf whose on-chain root matches circomlibjs", async () => {
    const { connection, payer, program } = chain;
    const commitment = 0x1234_5678_9abc_def0_1122_3344_5566_7788n;
    const ata = await getOrCreateAssociatedTokenAccount(connection, payer, mint, payer.publicKey);

    const sig = await program.methods
      .depositAndCommit(fieldBytes(commitment), new BN(FIRST_DEPOSIT.toString()))
      .accounts({
        vault: vaultPda,
        liquidVault: liquidPda,
        usdcMint: mint,
        depositorUsdc: ata.address,
        depositor: payer.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
    const tx = await connection.getTransaction(sig, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });
    console.log(`deposit_and_commit computeUnitsConsumed=${tx?.meta?.computeUnitsConsumed}`);

    const vault: any = await (chain.program.account as any).zkYieldVault.fetch(vaultPda);
    expect(vault.nextLeafIndex).toBe(1);
    expect(vault.currentRootIndex).toBe(2);
    expect(vault.totalPrincipalMicroUsdc.toString()).toBe(FIRST_DEPOSIT.toString());

    const tree = await buildMerkleTree([commitment], DEPTH);
    expect(rootBytesToHex(vault.rootHistory[1])).toBe(
      "0x" + tree.root.toString(16).padStart(64, "0"),
    );

    const liquid = await getAccount(connection, liquidPda);
    expect(liquid.amount).toBe(FIRST_DEPOSIT);
  }, 240_000);

  it("preserves prior roots in the ring buffer after a second deposit", async () => {
    const { connection, payer, program } = chain;
    const c1 = 0x1234_5678_9abc_def0_1122_3344_5566_7788n;
    const c2 = 0x0fed_cba9_8765_4321_0011_2233_4455_6677n;
    const ata = await getOrCreateAssociatedTokenAccount(connection, payer, mint, payer.publicKey);

    await program.methods
      .depositAndCommit(fieldBytes(c2), new BN(SECOND_DEPOSIT.toString()))
      .accounts({
        vault: vaultPda,
        liquidVault: liquidPda,
        usdcMint: mint,
        depositorUsdc: ata.address,
        depositor: payer.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    const vault: any = await (chain.program.account as any).zkYieldVault.fetch(vaultPda);
    expect(vault.nextLeafIndex).toBe(2);
    expect(vault.currentRootIndex).toBe(3);
    expect(vault.totalPrincipalMicroUsdc.toString()).toBe(
      (FIRST_DEPOSIT + SECOND_DEPOSIT).toString(),
    );

    const tree1 = await buildMerkleTree([c1], DEPTH);
    const tree2 = await buildMerkleTree([c1, c2], DEPTH);
    expect(rootBytesToHex(vault.rootHistory[1])).toBe(
      "0x" + tree1.root.toString(16).padStart(64, "0"),
    );
    expect(rootBytesToHex(vault.rootHistory[2])).toBe(
      "0x" + tree2.root.toString(16).padStart(64, "0"),
    );

    const liquid = await getAccount(connection, liquidPda);
    expect(liquid.amount).toBe(FIRST_DEPOSIT + SECOND_DEPOSIT);
  }, 240_000);
});
