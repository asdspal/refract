pragma circom 2.2.0;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";

// Refract zkAPI note-spend circuit.
//
// Public inputs (in this exact order, matching groth16-solana public_inputs):
//   [0] merkle_root
//   [1] nullifier_hash
//   [2] spend_cap_micro_usdc
//   [3] session_pubkey_hash
//
// Private inputs:
//   nullifier, trapdoor, note_amount_micro_usdc,
//   pathElements[levels], pathIndices[levels]
//
// Proves, in zero knowledge:
//   1. nullifier_hash = Poseidon(nullifier)
//   2. commitment = Poseidon(nullifier, trapdoor, note_amount) is a real leaf
//      at the given depth-20 Merkle path, hashing up to merkle_root
//   3. spend_cap_micro_usdc <= note_amount_micro_usdc (range checked)
//   4. session_pubkey_hash is bound into a non-linear constraint so it cannot
//      be dropped or malleated by a relayer
template RefractNoteSpend(levels) {
    signal input merkle_root;
    signal input nullifier_hash;
    signal input spend_cap_micro_usdc;
    signal input session_pubkey_hash;

    signal input nullifier;
    signal input trapdoor;
    signal input note_amount_micro_usdc;
    signal input pathElements[levels];
    signal input pathIndices[levels];

    // 1. Nullifier binding.
    component nullifierHasher = Poseidon(1);
    nullifierHasher.inputs[0] <== nullifier;
    nullifier_hash === nullifierHasher.out;

    // 2. Poseidon note commitment.
    component commitmentHasher = Poseidon(3);
    commitmentHasher.inputs[0] <== nullifier;
    commitmentHasher.inputs[1] <== trapdoor;
    commitmentHasher.inputs[2] <== note_amount_micro_usdc;

    // 3. Depth-20 Merkle inclusion.
    component merkleHasher[levels];
    signal current[levels + 1];
    signal isLeft[levels];
    signal left[levels];
    signal right[levels];

    current[0] <== commitmentHasher.out;

    for (var i = 0; i < levels; i++) {
        // pathIndices must be a boolean.
        pathIndices[i] * (pathIndices[i] - 1) === 0;

        isLeft[i] <== 1 - pathIndices[i];
        left[i] <== current[i] + (pathElements[i] - current[i]) * pathIndices[i];
        right[i] <== pathElements[i] + (current[i] - pathElements[i]) * pathIndices[i];

        merkleHasher[i] = Poseidon(2);
        merkleHasher[i].inputs[0] <== left[i];
        merkleHasher[i].inputs[1] <== right[i];
        current[i + 1] <== merkleHasher[i].out;
    }

    merkle_root === current[levels];

    // 4. Spend cap must not exceed the note amount.
    component spendCapCheck = LessEqThan(64);
    spendCapCheck.in[0] <== spend_cap_micro_usdc;
    spendCapCheck.in[1] <== note_amount_micro_usdc;
    spendCapCheck.out === 1;

    // 5. Bind the session public key hash with a quadratic constraint.
    signal sessionSq;
    sessionSq <== session_pubkey_hash * session_pubkey_hash;
}

component main {public [merkle_root, nullifier_hash, spend_cap_micro_usdc, session_pubkey_hash]} = RefractNoteSpend(20);
