import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
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
import { generateLocalZkNote, type LocalZkNote } from "../../src/lib/zkapi/clientNoteVault";
import { proveNoteSpend } from "../../src/lib/zkapi/proverClient";
import {
  mintRuntimeKey,
  setVerifierDeps,
  ZkMintError,
  type VerifierDeps,
} from "../../src/lib/zkapi/solanaVerifier";
import { POST as runtimeKeyPOST } from "../../src/app/api/v1/zkapi/runtime-key/route";

const describeChain = chainPrerequisitesAvailable() ? describe : describe.skip;
const root = resolve(__dirname, "../..");
const wasmPath = resolve(root, "public/circuits/refract_note_spend.wasm");
const zkeyPath = resolve(root, "public/circuits/refract_note_spend_final.zkey");
const NOTE_AMOUNT = 10_000_000n;
const nullifiers: string[] = [];

describeChain("POST /api/v1/zkapi/runtime-key (on-chain Groth16 mint)", () => {
  let chain: LocalChain;
  let deps: VerifierDeps;
  let mint: PublicKey;
  let vaultPda: PublicKey;
  let liquidPda: PublicKey;
  let defiPda: PublicKey;
  let depositorUsdc: PublicKey;
  let commitments: bigint[] = [];

  async function depositAndProve(note: LocalZkNote) {
    const ata = await getOrCreateAssociatedTokenAccount(
      chain.connection,
      chain.payer,
      mint,
      chain.payer.publicKey,
    );
    const commitment = BigInt(note.commitmentHex);
    await chain.program.methods
      .depositAndCommit(
        Array.from(Buffer.from(note.commitmentHex.slice(2), "hex")),
        new BN(NOTE_AMOUNT.toString()),
      )
      .accounts({
        vault: vaultPda,
        liquidVault: liquidPda,
        usdcMint: mint,
        depositorUsdc: ata.address,
        depositor: chain.payer.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
    const leafIndex = commitments.length;
    commitments.push(commitment);
    const proof = await proveNoteSpend({
      note,
      leavesHex: commitments.map((c) => "0x" + c.toString(16).padStart(64, "0")),
      leafIndex,
      spendCapMicroUsdc: NOTE_AMOUNT,
      wasmPath,
      zkeyPath,
    });
    return { proof, leafIndex };
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
          optimistic_utilized_micro_usdc, current_apy_bps, subsidy_bonus_bps, solana_slot, recorded_at)
       VALUES (25000000, 22500000, 2500000, 0, 940, 840, 444444, now() + interval '1 second')`,
    );
    await query(
      `UPDATE intent_deposits SET status='EXPIRED'
        WHERE status IN ('QUOTE_CREATED','OPTIMISTIC_CREDITED','PENDING_DEPOSIT')`,
    );

    chain = await startChain(18904);
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
    await mintTo(connection, payer, mint, depositorUsdc, payer.publicKey, 100_000_000);
    deps = { connection, program, relayer: payer, usdcMint: mint };
    setVerifierDeps(deps);
    commitments = [];
  }, 240_000);

  afterAll(async () => {
    setVerifierDeps(null);
    if (nullifiers.length > 0) {
      await query("DELETE FROM zk_runtime_sessions WHERE nullifier_hash_hex = ANY($1)", [
        nullifiers,
      ]);
    }
    await query("DELETE FROM defi_vault_snapshots WHERE solana_slot = 444444");
    await closePool();
    chain?.stop();
  });

  it(
    "verifies a real proof on Solana and mints a +8.4% subsidized runtime key",
    async () => {
      const note = await generateLocalZkNote(NOTE_AMOUNT);
      nullifiers.push(note.nullifierHashHex);
      const { proof } = await depositAndProve(note);

      const result = await mintRuntimeKey(
        {
          proofHex: proof.proofHex,
          merkleRootHex: proof.merkleRootHex,
          nullifierHashHex: proof.nullifierHashHex,
          spendCapMicroUsdc: Number(NOTE_AMOUNT),
          sessionPubkeyHashHex: proof.sessionPubkeyHashHex,
        },
        deps,
      );

      console.log(
        `runtime-key mint CU=${result.computeUnitsUsed}, subsidy=${result.yieldSubsidyMicroUsdc}`,
      );
      expect(result.runtimeKey).toMatch(/^rk_live_zk_[0-9a-f]{48}$/);
      expect(result.computeUnitsUsed).toBeGreaterThan(0);
      expect(result.computeUnitsUsed).toBeLessThanOrEqual(140_000);
      expect(result.yieldSubsidyMicroUsdc).toBe(840_000);
      expect(result.effectiveBalanceMicroUsdc).toBe(10_840_000);

      const session = await query<{
        principal: string;
        bonus: string;
        remaining: string;
        is_optimistic: boolean;
        sig: string;
      }>(
        `SELECT principal_micro_usdc::text AS principal,
                yield_subsidy_micro_usdc::text AS bonus,
                remaining_micro_usdc::text AS remaining,
                is_optimistic, solana_verify_tx_sig AS sig
           FROM zk_runtime_sessions WHERE nullifier_hash_hex = $1`,
        [note.nullifierHashHex],
      );
      expect(session.rows[0].principal).toBe("10000000");
      expect(session.rows[0].bonus).toBe("840000");
      expect(session.rows[0].remaining).toBe("10840000");
      expect(session.rows[0].is_optimistic).toBe(false);
      expect(session.rows[0].sig).toBe(result.solanaVerifyTxSig);
    },
    240_000,
  );

  it("rejects a replayed nullifier with 409", async () => {
    const note = await generateLocalZkNote(NOTE_AMOUNT);
    nullifiers.push(note.nullifierHashHex);
    // Don't deposit: insert a fake session to simulate an already-spent nullifier.
    await query(
      `INSERT INTO zk_runtime_sessions
         (nullifier_hash_hex, merkle_root_used_hex, runtime_key_hash,
          principal_micro_usdc, remaining_micro_usdc, status)
       VALUES ($1, $2, $3, 1000000, 1000000, 'ACTIVE')`,
      [
        note.nullifierHashHex,
        "0x" + randomBytes(32).toString("hex"),
        randomBytes(32).toString("hex"),
      ],
    );
    await expect(
      mintRuntimeKey(
        {
          proofHex: "0x" + randomBytes(256).toString("hex"),
          merkleRootHex: "0x" + randomBytes(32).toString("hex"),
          nullifierHashHex: note.nullifierHashHex,
          spendCapMicroUsdc: 1_000_000,
          sessionPubkeyHashHex: "0x" + randomBytes(32).toString("hex"),
        },
        deps,
      ),
    ).rejects.toMatchObject({ code: "ERR_NULLIFIER_ALREADY_SPENT", status: 409 });
  }, 60_000);

  it(
    "rejects a corrupted proof with 400 ERR_INVALID_GROTH16_PROOF",
    async () => {
      const note = await generateLocalZkNote(NOTE_AMOUNT);
      nullifiers.push(note.nullifierHashHex);
      const { proof } = await depositAndProve(note);

      const corrupted =
        proof.proofHex.slice(0, -2) +
        (proof.proofHex.slice(-2) === "00" ? "01" : "00");
      await expect(
        mintRuntimeKey(
          {
            proofHex: corrupted,
            merkleRootHex: proof.merkleRootHex,
            nullifierHashHex: proof.nullifierHashHex,
            spendCapMicroUsdc: Number(NOTE_AMOUNT),
            sessionPubkeyHashHex: proof.sessionPubkeyHashHex,
          },
          deps,
        ),
      ).rejects.toBeInstanceOf(ZkMintError);
    },
    240_000,
  );

  it(
    "route mints a runtime key end to end",
    async () => {
      const note = await generateLocalZkNote(NOTE_AMOUNT);
      nullifiers.push(note.nullifierHashHex);
      const { proof } = await depositAndProve(note);

      const res = await runtimeKeyPOST(
        new Request("http://localhost/api/v1/zkapi/runtime-key", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            proofHex: proof.proofHex,
            merkleRootHex: proof.merkleRootHex,
            nullifierHashHex: proof.nullifierHashHex,
            spendCapMicroUsdc: Number(NOTE_AMOUNT),
            sessionPubkeyHashHex: proof.sessionPubkeyHashHex,
          }),
        }),
      );
      expect(res.status).toBe(200);
      expect(res.headers.get("X-Correlation-Id")).toMatch(/^req_/);
      const body = await res.json();
      expect(body.runtimeKey).toMatch(/^rk_live_zk_/);
      expect(body.effectiveBalanceMicroUsdc).toBe(10_840_000);
    },
    240_000,
  );
});
