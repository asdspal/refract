import { groth16 } from "snarkjs";
import {
  computeNullifierHash,
  poseidonHash,
  toHex32,
} from "./merkleTree";
import { buildPathFromLeaves } from "./merklePathBuilder";
import {
  serializeGroth16ProofForSolana,
  type SnarkJsGroth16Proof,
} from "./bn254Serializer";
import type { LocalZkNote } from "./clientNoteVault";

export interface ProveNoteParams {
  note: LocalZkNote;
  leavesHex: string[];
  leafIndex: number;
  spendCapMicroUsdc: bigint;
  wasmPath?: string;
  zkeyPath?: string;
}

export interface ProveNoteResult {
  proofHex: string;
  merkleRootHex: string;
  nullifierHashHex: string;
  spendCapMicroUsdc: string;
  sessionPubkeyHashHex: string;
  publicInputs: [string, string, string, string];
  durationMs: number;
}

export interface ProofInput {
  merkle_root: string;
  nullifier_hash: string;
  spend_cap_micro_usdc: string;
  session_pubkey_hash: string;
  nullifier: string;
  trapdoor: string;
  note_amount_micro_usdc: string;
  pathElements: string[];
  pathIndices: string[];
}

const DEFAULT_WASM = "/circuits/refract_note_spend.wasm";
const DEFAULT_ZKEY = "/circuits/refract_note_spend_final.zkey";

export async function buildProofInput(
  params: ProveNoteParams,
): Promise<ProofInput> {
  const amount = BigInt(params.note.amountMicroUsdc);
  if (params.spendCapMicroUsdc <= 0n) {
    throw new Error("spendCapMicroUsdc must be positive");
  }
  if (params.spendCapMicroUsdc > amount) {
    throw new Error("spendCapMicroUsdc exceeds the note amount");
  }

  const path = await buildPathFromLeaves(
    params.leavesHex,
    params.leafIndex,
  );

  return {
    merkle_root: path.merkleRoot.toString(),
    nullifier_hash: BigInt(params.note.nullifierHashHex).toString(),
    spend_cap_micro_usdc: params.spendCapMicroUsdc.toString(),
    session_pubkey_hash: BigInt(params.note.sessionPubkeyHashHex).toString(),
    nullifier: BigInt(params.note.nullifierHex).toString(),
    trapdoor: BigInt(params.note.trapdoorHex).toString(),
    note_amount_micro_usdc: amount.toString(),
    pathElements: path.pathElements.map(String),
    pathIndices: path.pathIndices.map(String),
  };
}

function concatProof(proof: SnarkJsGroth16Proof): string {
  const serialized = serializeGroth16ProofForSolana(proof);
  const bytes = new Uint8Array(256);
  bytes.set(serialized.proofA, 0);
  bytes.set(serialized.proofB, 64);
  bytes.set(serialized.proofC, 192);
  let hex = "";
  for (const byte of bytes) hex += byte.toString(16).padStart(2, "0");
  return "0x" + hex;
}

/** Generate a Groth16 proof in the current thread (Node / server fallback). */
export async function proveNoteSpend(
  params: ProveNoteParams,
): Promise<ProveNoteResult> {
  const started = performance.now();
  const input = await buildProofInput(params);
  const { proof } = await groth16.fullProve(
    input as unknown as Record<string, unknown>,
    params.wasmPath ?? DEFAULT_WASM,
    params.zkeyPath ?? DEFAULT_ZKEY,
  );
  const proofHex = concatProof(proof as SnarkJsGroth16Proof);
  const durationMs = performance.now() - started;

  const nullifierHash = await computeNullifierHash(BigInt(params.note.nullifierHex));
  return {
    proofHex,
    merkleRootHex: toHex32(BigInt(input.merkle_root)),
    nullifierHashHex: toHex32(nullifierHash),
    spendCapMicroUsdc: input.spend_cap_micro_usdc,
    sessionPubkeyHashHex: toHex32(BigInt(input.session_pubkey_hash)),
    publicInputs: [
      toHex32(BigInt(input.merkle_root)),
      toHex32(nullifierHash),
      toHex32(BigInt(input.spend_cap_micro_usdc)),
      toHex32(BigInt(input.session_pubkey_hash)),
    ],
    durationMs,
  };
}

/**
 * Browser entry point: run `snarkjs.groth16.fullProve` inside a WebWorker so
 * the UI stays responsive. Falls back to the local thread without a Worker.
 */
export async function proveNoteSpendInWorker(
  params: ProveNoteParams,
): Promise<ProveNoteResult> {
  if (typeof Worker === "undefined") return proveNoteSpend(params);

  const started = performance.now();
  const input = await buildProofInput(params);
  const proof = await new Promise<SnarkJsGroth16Proof>((resolve, reject) => {
    const worker = new Worker(new URL("./prover.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (event) => {
      const data = event.data as { proof?: SnarkJsGroth16Proof; error?: string };
      worker.terminate();
      if (data.proof) resolve(data.proof);
      else reject(new Error(data.error ?? "WebWorker proving failed"));
    };
    worker.onerror = (event) => {
      worker.terminate();
      reject(new Error(event.message));
    };
    worker.postMessage({
      input: input as unknown as Record<string, unknown>,
      wasmPath: params.wasmPath ?? DEFAULT_WASM,
      zkeyPath: params.zkeyPath ?? DEFAULT_ZKEY,
    });
  });

  const proofHex = concatProof(proof);
  const nullifierHash = await computeNullifierHash(BigInt(params.note.nullifierHex));
  return {
    proofHex,
    merkleRootHex: toHex32(BigInt(input.merkle_root)),
    nullifierHashHex: toHex32(nullifierHash),
    spendCapMicroUsdc: input.spend_cap_micro_usdc,
    sessionPubkeyHashHex: toHex32(BigInt(input.session_pubkey_hash)),
    publicInputs: [
      toHex32(BigInt(input.merkle_root)),
      toHex32(nullifierHash),
      toHex32(BigInt(input.spend_cap_micro_usdc)),
      toHex32(BigInt(input.session_pubkey_hash)),
    ],
    durationMs: performance.now() - started,
  };
}

/** Derive the deterministic session key hash used to recover a runtime key. */
export async function deriveSessionPubkeyHash(nullifierHex: string): Promise<string> {
  const domain = BigInt("0x73657373696f6e5f6b6579"); // "session_key"
  return toHex32(await poseidonHash([BigInt(nullifierHex), domain]));
}
