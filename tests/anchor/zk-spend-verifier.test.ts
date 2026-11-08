import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { BN } from "@anchor-lang/core";
import { groth16 } from "snarkjs";
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
} from "./helpers";
import {
  buildMerkleTree,
  computeCommitment,
  computeNullifierHash,
  getMerkleProof,
} from "../../src/lib/zkapi/merkleTree";
import {
  serializeGroth16ProofForSolana,
  type SnarkJsGroth16Proof,
} from "../../src/lib/zkapi/bn254Serializer";

const describeChain = chainPrerequisitesAvailable() ? describe : describe.skip;

const root = resolve(__dirname, "../..");
const wasmPath = resolve(root, "public/circuits/refract_note_spend.wasm");
const zkeyPath = resolve(root, "public/circuits/refract_note_spend_final.zkey");
const NOTE_AMOUNT = 10_000_000n;
const SPEND_CAP = 5_000_000n;
const SESSION_KEY_HASH = 0x0abc_0def_1234_5678_9abc_0def_1234_5678n;

function randomField(): bigint {
  return BigInt("0x" + randomBytes(31).toString("hex"));
}

function bytes32(value: bigint | string): number[] {
  return Array.from(
    Buffer.from(BigInt(value).toString(16).padStart(64, "0"), "hex"),
  );
}

async function proveNote(opts: {
  nullifier: bigint;
  trapdoor: bigint;
  leaves: bigint[];
  leafIndex: number;
  spendCap: bigint;
}) {
  const commitment = await computeCommitment(
    opts.nullifier,
    opts.trapdoor,
    NOTE_AMOUNT,
  );
  const tree = await buildMerkleTree(opts.leaves);
  const proofData = getMerkleProof(tree, opts.leafIndex);
  const nullifierHash = await computeNullifierHash(opts.nullifier);

  const input = {
    merkle_root: tree.root.toString(),
    nullifier_hash: nullifierHash.toString(),
    spend_cap_micro_usdc: opts.spendCap.toString(),
    session_pubkey_hash: SESSION_KEY_HASH.toString(),
    nullifier: opts.nullifier.toString(),
    trapdoor: opts.trapdoor.toString(),
    note_amount_micro_usdc: NOTE_AMOUNT.toString(),
    pathElements: proofData.pathElements.map(String),
    pathIndices: proofData.pathIndices.map(String),
  };
  const { proof, publicSignals } = await groth16.fullProve(
    input,
    wasmPath,
    zkeyPath,
  );
  const serialized = serializeGroth16ProofForSolana(proof as SnarkJsGroth16Proof);
  return {
    commitment,
    nullifierHash,
    treeRoot: tree.root,
    proof,
    publicSignals,
    serialized,
  };
}

describeChain("settle_zk_spend: on-chain Groth16 verification & nullifier PDA", () => {
  let chain: LocalChain;
  let mint: PublicKey;
  let vaultPda: PublicKey;
  let liquidPda: PublicKey;

  beforeAll(async () => {
    chain = await startChain(18901);
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
    const ata = await getOrCreateAssociatedTokenAccount(
      connection,
      payer,
      mint,
      payer.publicKey,
    );
    await mintTo(connection, payer, mint, ata.address, payer.publicKey, 100_000_000);
  }, 240_000);

  afterAll(() => chain?.stop());

  it(
    "verifies a real snarkjs proof on-chain in <= 140,000 CU",
    async () => {
      const { connection, payer, program, programId } = chain;
      const nullifier = randomField();
      const trapdoor = randomField();
      const commitment = await computeCommitment(nullifier, trapdoor, NOTE_AMOUNT);
      const ata = await getOrCreateAssociatedTokenAccount(
        connection,
        payer,
        mint,
        payer.publicKey,
      );
      await program.methods
        .depositAndCommit(bytes32(commitment), new BN(NOTE_AMOUNT.toString()))
        .accounts({
          vault: vaultPda,
          liquidVault: liquidPda,
          usdcMint: mint,
          depositorUsdc: ata.address,
          depositor: payer.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      const proven = await proveNote({
        nullifier,
        trapdoor,
        leaves: [commitment],
        leafIndex: 0,
        spendCap: SPEND_CAP,
      });
      const publicInputs = proven.publicSignals.map((v) => bytes32(v));
      const nullifierBytes = bytes32(proven.nullifierHash);
      const [nullifierPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("nullifier"), Buffer.from(nullifierBytes)],
        programId,
      );

      const sig = await program.methods
        .settleZkSpend(
          Array.from(proven.serialized.proofA),
          Array.from(proven.serialized.proofB),
          Array.from(proven.serialized.proofC),
          publicInputs,
          nullifierBytes,
        )
        .accounts({
          vault: vaultPda,
          usdcMint: mint,
          nullifierRecord: nullifierPda,
          relayer: payer.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const tx = await connection.getTransaction(sig, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      });
      expect(tx?.meta?.err).toBeNull();
      const cu = tx?.meta?.computeUnitsConsumed ?? Number.POSITIVE_INFINITY;
      console.log(`settle_zk_spend computeUnitsConsumed=${cu}`);
      expect(cu).toBeLessThanOrEqual(140_000);

      const record = await (program.account as any).nullifierRecord.fetch(nullifierPda);
      expect((record as any).spendCapMicroUsdc.toString()).toBe(
        SPEND_CAP.toString(),
      );

      // Replay must fail deterministically (NullifierRecord PDA already exists).
      await expect(
        program.methods
          .settleZkSpend(
            Array.from(proven.serialized.proofA),
            Array.from(proven.serialized.proofB),
            Array.from(proven.serialized.proofC),
            publicInputs,
            nullifierBytes,
          )
          .accounts({
            vault: vaultPda,
            usdcMint: mint,
            nullifierRecord: nullifierPda,
            relayer: payer.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc(),
      ).rejects.toBeTruthy();
    },
    240_000,
  );

  it(
    "rejects a proof with a tampered public input",
    async () => {
      const { connection, payer, program, programId } = chain;
      const nullifier = randomField();
      const trapdoor = randomField();
      const commitment = await computeCommitment(nullifier, trapdoor, NOTE_AMOUNT);
      const ata = await getOrCreateAssociatedTokenAccount(
        connection,
        payer,
        mint,
        payer.publicKey,
      );
      await program.methods
        .depositAndCommit(bytes32(commitment), new BN((5_000_000n).toString()))
        .accounts({
          vault: vaultPda,
          liquidVault: liquidPda,
          usdcMint: mint,
          depositorUsdc: ata.address,
          depositor: payer.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      const proven = await proveNote({
        nullifier,
        trapdoor,
        leaves: [commitment],
        leafIndex: 0,
        spendCap: SPEND_CAP,
      });
      const tampered = proven.publicSignals.map((v) => bytes32(v));
      tampered[2] = bytes32(SPEND_CAP + 1n);
      const nullifierBytes = bytes32(proven.nullifierHash);
      const [nullifierPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("nullifier"), Buffer.from(nullifierBytes)],
        programId,
      );

      await expect(
        program.methods
          .settleZkSpend(
            Array.from(proven.serialized.proofA),
            Array.from(proven.serialized.proofB),
            Array.from(proven.serialized.proofC),
            tampered,
            nullifierBytes,
          )
          .accounts({
            vault: vaultPda,
            usdcMint: mint,
            nullifierRecord: nullifierPda,
            relayer: payer.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc(),
      ).rejects.toBeTruthy();

      const account = await connection.getAccountInfo(nullifierPda);
      expect(account).toBeNull();
    },
    240_000,
  );
});
