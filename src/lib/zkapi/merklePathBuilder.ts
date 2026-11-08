import { buildMerkleTree, getMerkleProof, type Field } from "./merkleTree";

export interface MerklePath {
  merkleRoot: Field;
  pathElements: Field[];
  pathIndices: number[];
}

export function findLeafIndex(
  leavesHex: string[],
  commitmentHex: string,
): number {
  const index = leavesHex.findIndex(
    (leaf) => leaf.toLowerCase() === commitmentHex.toLowerCase(),
  );
  if (index < 0) throw new Error("Commitment is not in the public Merkle tree");
  return index;
}

/** Build the depth-20 Poseidon sibling path from the public leaf list. */
export async function buildPathFromLeaves(
  leavesHex: string[],
  leafIndex: number,
  depth = 20,
): Promise<MerklePath> {
  const leaves: Field[] = leavesHex.map((hex) => BigInt(hex));
  if (leafIndex < 0 || leafIndex >= leaves.length) {
    throw new Error("leafIndex is out of range");
  }
  const tree = await buildMerkleTree(leaves, depth);
  const proof = getMerkleProof(tree, leafIndex);
  return {
    merkleRoot: tree.root,
    pathElements: proof.pathElements,
    pathIndices: proof.pathIndices,
  };
}
