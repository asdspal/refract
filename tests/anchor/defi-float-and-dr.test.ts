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
import { closePool, query } from "../../src/db/index";
import { rebuildFromChain } from "../../scripts/rebuild_from_chain";

const describeChain = chainPrerequisitesAvailable() ? describe : describe.skip;

const DEPOSIT = 100_000_000n; // $100.00

function bytes32(value: bigint): number[] {
  return Array.from(Buffer.from(value.toString(16).padStart(64, "0"), "hex"));
}

function hex32(value: bigint): string {
  return "0x" + value.toString(16).padStart(64, "0");
}

describeChain("90/10 DeFi float router, merchant PDA & chain rebuild", () => {
  let chain: LocalChain;
  let mint: PublicKey;
  let vaultPda: PublicKey;
  let liquidPda: PublicKey;
  let defiPda: PublicKey;
  let commitment: bigint;
  let offchainRoot: bigint;

  beforeAll(async () => {
    chain = await startChain(18902);
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
    [defiPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("defi_yield_vault"), vaultPda.toBuffer()],
      programId,
    );

    await program.methods
      .initializeVault(840)
      .accounts({
        vault: vaultPda,
        usdcMint: mint,
        liquidVault: liquidPda,
        defiYieldVault: defiPda,
        authority: payer.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    const ata = await getOrCreateAssociatedTokenAccount(
      connection,
      payer,
      mint,
      payer.publicKey,
    );
    await mintTo(connection, payer, mint, ata.address, payer.publicKey, DEPOSIT);

    commitment = 0x00ab_cdef_0123_4567_89ab_cdef_0123_4567n;
    await program.methods
      .depositAndCommit(bytes32(commitment), new BN(DEPOSIT.toString()))
      .accounts({
        vault: vaultPda,
        liquidVault: liquidPda,
        usdcMint: mint,
        depositorUsdc: ata.address,
        depositor: payer.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    const tree = await buildMerkleTree([commitment]);
    offchainRoot = tree.root;
  }, 240_000);

  afterAll(async () => {
    await closePool();
    chain?.stop();
  });

  it("rebalances to exactly 90% staked / 10% liquid", async () => {
    const { connection, program, payer } = chain;

    await program.methods
      .rebalanceDefiFloat()
      .accounts({
        vault: vaultPda,
        usdcMint: mint,
        liquidVault: liquidPda,
        defiYieldVault: defiPda,
        authority: payer.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    const liquid = await getAccount(connection, liquidPda);
    const staked = await getAccount(connection, defiPda);
    expect(liquid.amount).toBe(10_000_000n);
    expect(staked.amount).toBe(90_000_000n);

    const vault: any = await (chain.program.account as any).zkYieldVault.fetch(vaultPda);
    expect(vault.totalPrincipalMicroUsdc.toString()).toBe(DEPOSIT.toString());

    // A second rebalance is a no-op.
    await program.methods
      .rebalanceDefiFloat()
      .accounts({
        vault: vaultPda,
        usdcMint: mint,
        liquidVault: liquidPda,
        defiYieldVault: defiPda,
        authority: payer.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
    expect((await getAccount(connection, liquidPda)).amount).toBe(10_000_000n);
    expect((await getAccount(connection, defiPda)).amount).toBe(90_000_000n);
  }, 240_000);

  it("initializes a merchant PDA and settles revenue", async () => {
    const { connection, program, payer, programId } = chain;
    const [merchantPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("merchant"), payer.publicKey.toBuffer()],
      programId,
    );

    await program.methods
      .initializeMerchant()
      .accounts({
        merchant: merchantPda,
        usdcMint: mint,
        authority: payer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const merchantAta = await getOrCreateAssociatedTokenAccount(
      connection,
      payer,
      mint,
      payer.publicKey,
    );
    await program.methods
      .settleMerchantRevenue(new BN(1_000_000))
      .accounts({
        vault: vaultPda,
        usdcMint: mint,
        liquidVault: liquidPda,
        merchant: merchantPda,
        merchantUsdc: merchantAta.address,
        authority: payer.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    const merchant: any = await (chain.program.account as any).merchantAccount.fetch(merchantPda);
    expect(merchant.totalRevenueMicroUsdc.toString()).toBe("1000000");
    expect((await getAccount(connection, merchantAta.address)).amount).toBe(1_000_000n);
  }, 240_000);

  it("rebuilds merkle_leaves from Solana events (RPO = 0)", async () => {
    await query("TRUNCATE TABLE merkle_leaves");
    const result = await rebuildFromChain({
      connection: chain.connection,
      vaultPda,
    });

    expect(result.count).toBe(1);
    expect(result.durationMs).toBeLessThan(30_000);

    const rows = await query<{
      leaf_index: number;
      commitment_hex: string;
      merkle_root_after_hex: string;
    }>(
      "SELECT leaf_index, commitment_hex, merkle_root_after_hex FROM merkle_leaves ORDER BY leaf_index",
    );
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].leaf_index).toBe(0);
    expect(rows.rows[0].commitment_hex).toBe(hex32(commitment));
    expect(rows.rows[0].merkle_root_after_hex).toBe(hex32(offchainRoot));

    // Idempotent.
    const again = await rebuildFromChain({
      connection: chain.connection,
      vaultPda,
    });
    expect(again.count).toBe(1);
    const count = await query<{ count: string }>(
      "SELECT count(*)::text AS count FROM merkle_leaves",
    );
    expect(Number(count.rows[0].count)).toBe(1);
  }, 120_000);
});
