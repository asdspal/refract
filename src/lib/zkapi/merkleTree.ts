import { buildPoseidon } from "circomlibjs";

export const MERKLE_DEPTH = 20;

export type Field = bigint;

let poseidonPromise: ReturnType<typeof buildPoseidon> | undefined;

async function getPoseidon() {
  return (poseidonPromise ??= buildPoseidon());
}

export async function poseidonHash(inputs: Field[]): Promise<Field> {
  const poseidon = await getPoseidon();
  const hash = poseidon(inputs);
  return poseidon.F.toObject(hash) as bigint;
}

export function toField(value: Field | string | number): Field {
  return typeof value === "bigint" ? value : BigInt(value);
}

export async function computeCommitment(
  nullifier: Field,
  trapdoor: Field,
  amountMicroUsdc: Field,
): Promise<Field> {
  return poseidonHash([nullifier, trapdoor, amountMicroUsdc]);
}

export async function computeNullifierHash(nullifier: Field): Promise<Field> {
  return poseidonHash([nullifier]);
}

export function toHex32(value: Field): string {
  return "0x" + value.toString(16).padStart(64, "0");
}

export interface MerkleTree {
  root: Field;
  levels: Field[][];
  zeroHashes: Field[];
}

export interface MerkleProof {
  root: Field;
  pathElements: Field[];
  pathIndices: number[];
  leaf: Field;
}

export async function computeZeroHashes(depth = MERKLE_DEPTH): Promise<Field[]> {
  const zeroHashes: Field[] = [0n];
  for (let i = 1; i <= depth; i++) {
    zeroHashes.push(await poseidonHash([zeroHashes[i - 1], zeroHashes[i - 1]]));
  }
  return zeroHashes;
}

export async function buildMerkleTree(
  leaves: Field[],
  depth = MERKLE_DEPTH,
): Promise<MerkleTree> {
  const zeroHashes = await computeZeroHashes(depth);
  const levels: Field[][] = [leaves.slice()];
  for (let d = 0; d < depth; d++) {
    const level = levels[d];
    const next: Field[] = [];
    const nodeCount = Math.max(1, Math.ceil(level.length / 2));
    for (let i = 0; i < nodeCount; i++) {
      const left = level[2 * i] ?? zeroHashes[d];
      const right = level[2 * i + 1] ?? zeroHashes[d];
      next.push(await poseidonHash([left, right]));
    }
    levels.push(next);
  }
  const root = levels[depth][0] ?? zeroHashes[depth];
  return { root, levels, zeroHashes };
}

export function getMerkleProof(tree: MerkleTree, leafIndex: number): MerkleProof {
  const depth = tree.levels.length - 1;
  const pathElements: Field[] = [];
  const pathIndices: number[] = [];
  for (let d = 0; d < depth; d++) {
    const nodeIndex = leafIndex >> d;
    const sibling = nodeIndex ^ 1;
    pathElements.push(tree.levels[d][sibling] ?? tree.zeroHashes[d]);
    pathIndices.push(nodeIndex & 1);
  }
  return {
    root: tree.root,
    pathElements,
    pathIndices,
    leaf: tree.levels[0][leafIndex],
  };
}
