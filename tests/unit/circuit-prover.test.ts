import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { groth16 } from "snarkjs";
import {
  buildMerkleTree,
  computeCommitment,
  computeNullifierHash,
  getMerkleProof,
} from "../../src/lib/zkapi/merkleTree";

const root = resolve(__dirname, "../..");
const wasmPath = resolve(root, "public/circuits/refract_note_spend.wasm");
const zkeyPath = resolve(root, "public/circuits/refract_note_spend_final.zkey");
const vkPath = resolve(root, "build/circuits/verification_key.json");

const NOTE_AMOUNT = 10_000_000n; // $10.00
const SPEND_CAP = 5_000_000n; // $5.00
const SESSION_PUBKEY_HASH = 0x1234_5678_9abc_def0n;

function randomField(): bigint {
  const buf = randomBytes(31);
  return BigInt("0x" + buf.toString("hex"));
}

describe("depth-20 zkAPI note-spend circuit", () => {
  let nullifier: bigint;
  let trapdoor: bigint;
  let input: Record<string, unknown>;
  let verificationKey: unknown;

  beforeAll(async () => {
    nullifier = randomField();
    trapdoor = randomField();
    const commitment = await computeCommitment(nullifier, trapdoor, NOTE_AMOUNT);
    const tree = await buildMerkleTree([commitment]);
    const proofData = getMerkleProof(tree, 0);
    const nullifierHash = await computeNullifierHash(nullifier);

    input = {
      merkle_root: tree.root.toString(),
      nullifier_hash: nullifierHash.toString(),
      spend_cap_micro_usdc: SPEND_CAP.toString(),
      session_pubkey_hash: SESSION_PUBKEY_HASH.toString(),
      nullifier: nullifier.toString(),
      trapdoor: trapdoor.toString(),
      note_amount_micro_usdc: NOTE_AMOUNT.toString(),
      pathElements: proofData.pathElements.map(String),
      pathIndices: proofData.pathIndices.map(String),
    };
    verificationKey = JSON.parse(readFileSync(vkPath, "utf8"));
  }, 120_000);

  it("generates a valid Groth16 proof and verifies it", async () => {
    const started = performance.now();
    const { proof, publicSignals } = await groth16.fullProve(input, wasmPath, zkeyPath);
    const elapsed = performance.now() - started;
    console.log(`groth16 fullProve (node): ${elapsed.toFixed(0)}ms`);

    expect(publicSignals).toHaveLength(4);
    expect(publicSignals[0]).toBe(input.merkle_root);
    expect(publicSignals[1]).toBe(input.nullifier_hash);
    expect(publicSignals[2]).toBe(input.spend_cap_micro_usdc);
    expect(publicSignals[3]).toBe(input.session_pubkey_hash);

    await expect(groth16.verify(verificationKey, publicSignals, proof)).resolves.toBe(true);
    expect(elapsed).toBeLessThan(10_000);
  }, 120_000);

  it("rejects a spend cap greater than the note amount", async () => {
    const overCap = { ...input, spend_cap_micro_usdc: (NOTE_AMOUNT + 1n).toString() };
    await expect(groth16.fullProve(overCap, wasmPath, zkeyPath)).rejects.toBeTruthy();
  }, 120_000);

  it("rejects a tampered public input", async () => {
    const { proof, publicSignals } = await groth16.fullProve(input, wasmPath, zkeyPath);
    const tampered = [...publicSignals];
    tampered[0] = (BigInt(tampered[0]) + 1n).toString();
    await expect(groth16.verify(verificationKey, tampered, proof)).resolves.toBe(false);
  }, 120_000);
});
