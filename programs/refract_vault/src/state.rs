use anchor_lang::prelude::*;

pub use crate::zero_hashes::MERKLE_DEPTH;

pub const ROOT_HISTORY_SIZE: usize = 32;

/// Zero-copy vault state: incremental depth-20 Poseidon Merkle tree, root ring
/// buffer, and DeFi float accounting. Total `size_of` = 1,824 bytes; with the
/// 8-byte Anchor discriminator the account is 1,832 bytes (~0.0138 SOL rent).
#[account(zero_copy)]
#[repr(C)]
pub struct ZkYieldVault {
    pub authority: Pubkey,
    pub usdc_mint: Pubkey,
    pub liquid_vault: Pubkey,
    pub defi_yield_vault: Pubkey,
    pub filled_subtrees: [[u8; 32]; MERKLE_DEPTH],
    pub root_history: [[u8; 32]; ROOT_HISTORY_SIZE],
    pub total_principal_micro_usdc: u64,
    pub total_yield_harvested_micro_usdc: u64,
    pub next_leaf_index: u32,
    pub current_root_index: u32,
    pub subsidy_bonus_bps: u16,
    pub bump: u8,
    pub _padding: [u8; 5],
}

/// One PDA per spent nullifier; `init` makes replay fail deterministically.
#[account]
pub struct NullifierRecord {
    pub nullifier_hash: [u8; 32],
    pub spend_cap_micro_usdc: u64,
    pub session_pubkey_hash: [u8; 32],
    pub spent_at_slot: u64,
    pub bump: u8,
}

impl NullifierRecord {
    pub const LEN: usize = 8 + 32 + 8 + 32 + 8 + 1;
}

/// Per-merchant revenue and DeFi float accounting PDA.
#[account]
pub struct MerchantAccount {
    pub authority: Pubkey,
    pub usdc_mint: Pubkey,
    pub total_revenue_micro_usdc: u64,
    pub defi_staked_micro_usdc: u64,
    pub yield_earned_micro_usdc: u64,
    pub bump: u8,
}

impl MerchantAccount {
    pub const LEN: usize = 8 + 32 + 32 + 8 + 8 + 8 + 1;
}
