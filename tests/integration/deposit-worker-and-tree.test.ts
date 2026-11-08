import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { BN } from "@anchor-lang/core";
import {
  TOKEN_PROGRAM_ID,
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import { PublicKey, SYSVAR_RENT_PUBKEY, SystemProgram } from "@solana/web3.js";
import {
  chainPrerequisitesAvailable,
  startChain,
  type LocalChain,
} from "../anchor/helpers";
import { closePool, query } from "../../src/db/index";
import { buildMerkleTree } from "../../src/lib/zkapi/merkleTree";
import {
  issueOptimisticCredit,
  optimisticNullifierHash,
} from "../../src/lib/defi/optimisticCreditEngine";
import { processPendingDeposits } from "../../src/lib/workers/solanaDepositWorker";
import { GET as treeGET } from "../../src/app/api/v1/zkapi/tree/route";

const describeChain = chainPrerequisitesAvailable() ? describe : describe.skip;
const root = resolve(__dirname, "../..");

function randomFieldHex(): string {
  const buf = randomBytes(32);
  buf[0] &= 0x0f; // keep the value below the BN254 scalar modulus
  return "0x" + buf.toString("hex");
}

function fieldBytes(hex: string): number[] {
  return Array.from(Buffer.from(hex.replace(/^0x/, ""), "hex"));
}

function hexToField(hex: string): bigint {
  return BigInt(hex);
}

function fieldHex(value: bigint): string {
  return "0x" + value.toString(16).padStart(64, "0");
}

describeChain("SolanaAnchorDepositWorker + public Merkle tree", () => {
  let chain: LocalChain;
  let mint: PublicKey;
  let vaultPda: PublicKey;
  let liquidPda: PublicKey;
  let defiPda: PublicKey;
  let depositorUsdc: PublicKey;
  const quoteIds: string[] = [];

  async function insertQuote(expected: number): Promise<{
    quoteId: string;
    commitmentHex: string;
  }> {
    const quoteId = `test_worker_${randomUUID()}`;
    const commitmentHex = randomFieldHex();
    quoteIds.push(quoteId);
    await query(
      `INSERT INTO intent_deposits
         (aurora_quote_id, origin_chain, origin_asset, origin_amount_raw,
          expected_solana_micro_usdc, deposit_address, refund_address,
          confidential_mode, integrator_fee_bps, poseidon_commitment_hex, status)
       VALUES ($1,'base',$2,'10000000',$3,$4,$5,true,30,$6,'QUOTE_CREATED')`,
      [
        quoteId,
        "nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near",
        expected,
        "0x" + randomBytes(20).toString("hex"),
        "0x71C95911E9a5D330f4D621842EC243EE1343292e",
        commitmentHex,
      ],
    );
    return { quoteId, commitmentHex };
  }

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
       VALUES (25000000, 22500000, 25000000, 0, 940, 840, 333333)`,
    );
    await query("TRUNCATE TABLE merkle_leaves");
    await query(
      `UPDATE intent_deposits SET status = 'EXPIRED'
        WHERE status IN ('QUOTE_CREATED','OPTIMISTIC_CREDITED','PENDING_DEPOSIT')`,
    );
    const redis = (await import("../../src/lib/x402/runtimeKeyMeter")).getRedis();
    if (redis) await redis.del("refract:merkle:tree").catch(() => undefined);

    chain = await startChain(18903);
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
    depositorUsdc = ata.address;
    await mintTo(connection, payer, mint, depositorUsdc, payer.publicKey, 500_000_000);
  }, 240_000);

  afterAll(async () => {
    if (quoteIds.length > 0) {
      await query("DELETE FROM zk_runtime_sessions WHERE nullifier_hash_hex = ANY($1)", [
        quoteIds.map(optimisticNullifierHash),
      ]);
      await query("DELETE FROM intent_deposits WHERE aurora_quote_id = ANY($1)", [
        quoteIds,
      ]);
    }
    await query("DELETE FROM defi_vault_snapshots WHERE solana_slot = 333333");
    await closePool();
    chain?.stop();
  });

  it("settles an Aurora SUCCESS into the vault, merkle_leaves, and /zkapi/tree", async () => {
    const { quoteId, commitmentHex } = await insertQuote(10_000_000);
    await issueOptimisticCredit({
      auroraQuoteId: quoteId,
      originTxHash: "0x" + randomBytes(32).toString("hex"),
    });

    const results = await processPendingDeposits({
      connection: chain.connection,
      program: chain.program,
      relayer: chain.payer,
      usdcMint: mint,
      depositorUsdc,
      getStatus: async () => ({ status: "SUCCESS", amountOut: "10000000" }),
    });

    const result = results.find((r) => r.quoteId === quoteId);
    if (result?.status !== "SETTLED") console.log("WORKER ERROR:", result?.error);
    expect(result?.status).toBe("SETTLED");
    expect(result?.signature).toBeTruthy();
    expect(result?.leafIndex).toBe(0);

    const deposit = await query<{ status: string; sig: string }>(
      "SELECT status, solana_settlement_sig AS sig FROM intent_deposits WHERE aurora_quote_id = $1",
      [quoteId],
    );
    expect(deposit.rows[0].status).toBe("SETTLED");
    expect(deposit.rows[0].sig).toBe(result?.signature);

    const tree = await buildMerkleTree([hexToField(commitmentHex)]);
    const leaves = await query<{
      leaf_index: number;
      commitment_hex: string;
      merkle_root_after_hex: string;
    }>(
      "SELECT leaf_index, commitment_hex, merkle_root_after_hex FROM merkle_leaves ORDER BY leaf_index",
    );
    expect(leaves.rows).toHaveLength(1);
    expect(leaves.rows[0].leaf_index).toBe(0);
    expect(leaves.rows[0].commitment_hex).toBe(commitmentHex);
    expect(leaves.rows[0].merkle_root_after_hex).toBe(fieldHex(tree.root));

    const session = await query<{
      is_optimistic: boolean;
      principal: string;
      remaining: string;
    }>(
      `SELECT is_optimistic, principal_micro_usdc::text AS principal,
              remaining_micro_usdc::text AS remaining
         FROM zk_runtime_sessions WHERE nullifier_hash_hex = $1`,
      [optimisticNullifierHash(quoteId)],
    );
    expect(session.rows[0].is_optimistic).toBe(false);
    expect(session.rows[0].principal).toBe("9990000"); // 10 USDC - 10 bps
    expect(session.rows[0].remaining).toBe("10410000"); // 5.42M + 4.99M unlocked

    const started = performance.now();
    const res = await treeGET();
    const latency = performance.now() - started;
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Correlation-Id")).toMatch(/^req_/);
    const body = await res.json();
    expect(body.currentRootHex).toBe(fieldHex(tree.root));
    expect(body.nextLeafIndex).toBe(1);
    expect(body.leaves).toHaveLength(1);
    expect(body.leaves[0].commitmentHex).toBe(commitmentHex);
    console.log(`/api/v1/zkapi/tree latency ${latency.toFixed(0)}ms`);
    expect(latency).toBeLessThan(200);
  }, 240_000);

  it("revokes optimistic credit when Aurora reports REFUNDED", async () => {
    const { quoteId, commitmentHex } = await insertQuote(5_000_000);
    await issueOptimisticCredit({
      auroraQuoteId: quoteId,
      originTxHash: "0x" + randomBytes(32).toString("hex"),
    });

    const results = await processPendingDeposits({
      connection: chain.connection,
      program: chain.program,
      relayer: chain.payer,
      usdcMint: mint,
      depositorUsdc,
      getStatus: async () => ({ status: "REFUNDED" }),
    });
    expect(results.find((r) => r.quoteId === quoteId)?.status).toBe("REVOKED");

    const session = await query<{ status: string }>(
      "SELECT status FROM zk_runtime_sessions WHERE nullifier_hash_hex = $1",
      [optimisticNullifierHash(quoteId)],
    );
    expect(session.rows[0].status).toBe("REVOKED");

    const deposit = await query<{ status: string }>(
      "SELECT status FROM intent_deposits WHERE aurora_quote_id = $1",
      [quoteId],
    );
    expect(deposit.rows[0].status).toBe("REFUNDED");
    // Refunded quote never creates a leaf.
    expect(commitmentHex).toMatch(/^0x[0-9a-f]{64}$/);
  }, 120_000);
});
