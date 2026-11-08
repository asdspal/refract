use crate::state::{ZkYieldVault, MERKLE_DEPTH};
use crate::zero_hashes::ZERO_HASHES;
use crate::RefractError;
use anchor_lang::prelude::*;
use solana_poseidon::{hashv, Endianness, Parameters};

/// Poseidon(2) via the Solana native syscall (circom-compatible BN254 X5).
/// The host fallback (unit tests) uses light-poseidon and yields identical bytes.
pub fn poseidon2(left: &[u8; 32], right: &[u8; 32]) -> Result<[u8; 32]> {
    let hash = hashv(Parameters::Bn254X5, Endianness::BigEndian, &[left, right])
        .map_err(|_| error!(RefractError::PoseidonError))?;
    Ok(hash.to_bytes())
}

/// Incremental Merkle insertion (Tornado-style). Costs 20 Poseidon hashes
/// because zero-subtree hashes are precomputed in `zero_hashes.rs`.
pub fn insert_leaf(
    vault: &mut ZkYieldVault,
    commitment: [u8; 32],
    leaf_index: usize,
) -> Result<[u8; 32]> {
    let mut current_index = leaf_index;
    let mut current_hash = commitment;
    for level in 0..MERKLE_DEPTH {
        if current_index % 2 == 0 {
            vault.filled_subtrees[level] = current_hash;
            current_hash = poseidon2(&current_hash, &ZERO_HASHES[level])?;
        } else {
            current_hash = poseidon2(&vault.filled_subtrees[level], &current_hash)?;
        }
        current_index /= 2;
    }
    Ok(current_hash)
}

pub fn is_known_root(vault: &ZkYieldVault, root: &[u8; 32]) -> bool {
    vault.root_history.iter().any(|candidate| candidate == root)
}

pub fn empty_root() -> [u8; 32] {
    ZERO_HASHES[MERKLE_DEPTH]
}
