import { buildPoseidon } from "circomlibjs";

// BN254 base field prime q (G1/G2 coordinates live here).
export const BN254_FIELD_MODULUS_Q =
  21888242871839275222246405745257275088696311157297823662689037894645226208583n;

// BN254 scalar field modulus r (public inputs / commitments live here).
export const BN254_SCALAR_MODULUS_R =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n

type BigIntish = bigint | string | number;

export interface SnarkJsGroth16Proof {
  pi_a: [string, string, ...string[]];
  pi_b: [[string, string], [string, string], ...unknown[]];
  pi_c: [string, string, ...string[]];
  protocol?: string;
  curve?: string;
}

export interface SolanaGroth16Proof {
  proofA: Uint8Array; // 64 bytes
  proofB: Uint8Array; // 128 bytes
  proofC: Uint8Array; // 64 bytes
}

export function toBigInt(value: BigIntish): bigint {
  return typeof value === "bigint" ? value : BigInt(value);
}

/** Encode a field element as a 32-byte big-endian buffer. */
export function feToBigEndian32(value: BigIntish): Uint8Array {
  const n = toBigInt(value);
  if (n < 0n) throw new Error("Field element must be non-negative");
  const hex = n.toString(16).padStart(64, "0");
  if (hex.length > 64) throw new Error("Field element exceeds 32 bytes");
  return Uint8Array.from(Buffer.from(hex, "hex"));
}

/** Serialize a G1 point as 64 bytes: x (32B BE) || y (32B BE). */
export function serializeG1(x: BigIntish, y: BigIntish): Uint8Array {
  const out = new Uint8Array(64);
  out.set(feToBigEndian32(x), 0);
  out.set(feToBigEndian32(y), 32);
  return out;
}

/** Negate a G1 y-coordinate modulo the BN254 base field prime q. */
export function negateG1Y(y: BigIntish): bigint {
  const yn = toBigInt(y);
  const neg = (BN254_FIELD_MODULUS_Q - (yn % BN254_FIELD_MODULUS_Q)) % BN254_FIELD_MODULUS_Q;
  return neg;
}

/** Serialize a G1 point as 64 bytes: x (32B BE) || (-y mod q) (32B BE). */
export function negateAndSerializeG1(x: BigIntish, y: BigIntish): Uint8Array {
  const out = new Uint8Array(64);
  out.set(feToBigEndian32(x), 0);
  out.set(feToBigEndian32(negateG1Y(y)), 32);
  return out;
}

/**
 * Serialize a G2 point as 128 bytes in EIP-197 / groth16-solana order:
 * x_c1 || x_c0 || y_c1 || y_c0, each 32 bytes big-endian.
 */
export function serializeG2(
  x: [BigIntish, BigIntish],
  y: [BigIntish, BigIntish],
): Uint8Array {
  const out = new Uint8Array(128);
  out.set(feToBigEndian32(x[1]), 0);
  out.set(feToBigEndian32(x[0]), 32);
  out.set(feToBigEndian32(y[1]), 64);
  out.set(feToBigEndian32(y[0]), 96);
  return out;
}

/** Convert a snarkjs Groth16 proof into the exact bytes groth16-solana 0.2.0 expects. */
export function serializeGroth16ProofForSolana(
  proof: SnarkJsGroth16Proof,
): SolanaGroth16Proof {
  return {
    proofA: negateAndSerializeG1(proof.pi_a[0], proof.pi_a[1]),
    proofB: serializeG2(
      [proof.pi_b[0][0], proof.pi_b[0][1]],
      [proof.pi_b[1][0], proof.pi_b[1][1]],
    ),
    // Only proof A is negated; B and C are passed through (big-endian).
    proofC: serializeG1(proof.pi_c[0], proof.pi_c[1]),
  };
}

let poseidonPromise: Promise<any> | undefined;

function getPoseidon(): Promise<any> {
  return (poseidonPromise ??= buildPoseidon());
}

/**
 * commitment = Poseidon(nullifier, trapdoor, amount_micro_usdc)
 * Returned as a 0x-prefixed 32-byte hex string in the BN254 scalar field.
 */
export async function computePoseidonCommitment(
  nullifier: BigIntish,
  trapdoor: BigIntish,
  amountMicroUsdc: BigIntish,
): Promise<string> {
  const poseidon = await getPoseidon();
  const hash = poseidon([toBigInt(nullifier), toBigInt(trapdoor), toBigInt(amountMicroUsdc)]);
  const str = poseidon.F.toString(hash, 10);
  const value = BigInt(str);
  if (value >= BN254_SCALAR_MODULUS_R) {
    throw new Error("Poseidon commitment outside BN254 scalar field");
  }
  return "0x" + value.toString(16).padStart(64, "0");
}

/** Normalize four public inputs to 32-byte big-endian buffers. */
export function serializePublicInputs(inputs: BigIntish[]): Uint8Array[] {
  if (inputs.length !== 4) throw new Error("Expected exactly 4 public inputs");
  return inputs.map((v) => feToBigEndian32(v));
}
