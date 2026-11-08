use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

pub mod merkle;
pub mod state;
pub mod verifying_key;
pub mod zero_hashes;

use merkle::{empty_root, insert_leaf};
use state::{NullifierRecord, ZkYieldVault, MERKLE_DEPTH, ROOT_HISTORY_SIZE};

declare_id!("HyeAVxJxt37ndAE2LJBKJ36j8vKLv6PezvwxA2NsmhvH");

#[program]
pub mod refract_vault {
    use super::*;

    /// Baseline scaffold instruction used to prove the program builds and deploys.
    pub fn ping_vault(ctx: Context<PingVault>) -> Result<()> {
        emit!(VaultPinged {
            slot: Clock::get()?.slot,
            authority: ctx.accounts.authority.key(),
        });
        Ok(())
    }

    /// Create the zero-copy vault PDA and its liquid USDC token account.
    pub fn initialize_vault(ctx: Context<InitializeVault>, subsidy_bonus_bps: u16) -> Result<()> {
        let vault_key = ctx.accounts.vault.key();
        let usdc_mint_key = ctx.accounts.usdc_mint.key();
        let liquid_vault_key = ctx.accounts.liquid_vault.key();
        let bump = ctx.bumps.vault;

        let mut vault = ctx.accounts.vault.load_init()?;
        vault.authority = vault_key;
        vault.usdc_mint = usdc_mint_key;
        vault.liquid_vault = liquid_vault_key;
        vault.defi_yield_vault = Pubkey::default();
        vault.filled_subtrees = core::array::from_fn(|i| zero_hashes::ZERO_HASHES[i]);
        vault.root_history = [[0u8; 32]; ROOT_HISTORY_SIZE];
        vault.root_history[0] = empty_root();
        vault.current_root_index = 1;
        vault.next_leaf_index = 0;
        vault.total_principal_micro_usdc = 0;
        vault.total_yield_harvested_micro_usdc = 0;
        vault.subsidy_bonus_bps = subsidy_bonus_bps;
        vault.bump = bump;

        emit!(VaultInitialized {
            vault: vault_key,
            usdc_mint: usdc_mint_key,
            subsidy_bonus_bps,
        });
        Ok(())
    }

    /// Transfer settled USDC into the vault and insert the Poseidon commitment
    /// into the depth-20 Merkle tree.
    pub fn deposit_and_commit(
        ctx: Context<DepositAndCommit>,
        commitment: [u8; 32],
        amount_micro_usdc: u64,
    ) -> Result<()> {
        require!(amount_micro_usdc > 0, RefractError::InvalidAmount);

        let mut vault = ctx.accounts.vault.load_mut()?;
        let leaf_index = vault.next_leaf_index as usize;
        require!(
            leaf_index < (1usize << MERKLE_DEPTH),
            RefractError::MerkleTreeFull
        );

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.key(),
                Transfer {
                    from: ctx.accounts.depositor_usdc.to_account_info(),
                    to: ctx.accounts.liquid_vault.to_account_info(),
                    authority: ctx.accounts.depositor.to_account_info(),
                },
            ),
            amount_micro_usdc,
        )?;

        let root_index = vault.current_root_index as usize;
        let new_root = insert_leaf(&mut *vault, commitment, leaf_index)?;

        vault.next_leaf_index = (leaf_index + 1) as u32;
        vault.root_history[root_index] = new_root;
        vault.current_root_index = ((root_index + 1) % ROOT_HISTORY_SIZE) as u32;
        vault.total_principal_micro_usdc = vault
            .total_principal_micro_usdc
            .checked_add(amount_micro_usdc)
            .ok_or(RefractError::MathOverflow)?;

        emit!(DepositCommitted {
            leaf_index: leaf_index as u32,
            commitment,
            new_root,
            amount_micro_usdc,
        });
        Ok(())
    }
}

#[derive(Accounts)]
pub struct PingVault<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct InitializeVault<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + core::mem::size_of::<ZkYieldVault>(),
        seeds = [b"refract_vault", usdc_mint.key().as_ref()],
        bump,
    )]
    pub vault: AccountLoader<'info, ZkYieldVault>,

    pub usdc_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = authority,
        token::mint = usdc_mint,
        token::authority = vault,
        seeds = [b"liquid_vault", vault.key().as_ref()],
        bump,
    )]
    pub liquid_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct DepositAndCommit<'info> {
    #[account(
        mut,
        seeds = [b"refract_vault", usdc_mint.key().as_ref()],
        bump,
    )]
    pub vault: AccountLoader<'info, ZkYieldVault>,

    #[account(
        mut,
        seeds = [b"liquid_vault", vault.key().as_ref()],
        bump,
    )]
    pub liquid_vault: Account<'info, TokenAccount>,

    pub usdc_mint: Account<'info, Mint>,

    #[account(
        mut,
        token::mint = usdc_mint,
        token::authority = depositor,
    )]
    pub depositor_usdc: Account<'info, TokenAccount>,

    #[account(mut)]
    pub depositor: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

#[error_code]
pub enum RefractError {
    #[msg("Merkle root is not in the recent root history")]
    UnknownMerkleRoot,
    #[msg("Groth16 proof verification failed")]
    InvalidGroth16Proof,
    #[msg("Spend cap must be greater than zero")]
    SpendCapZero,
    #[msg("Poseidon hashing failed")]
    PoseidonError,
    #[msg("Merkle tree is full")]
    MerkleTreeFull,
    #[msg("Amount must be greater than zero")]
    InvalidAmount,
    #[msg("USDC mint mismatch")]
    InvalidMint,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Nullifier already spent")]
    NullifierAlreadySpent,
}

#[event]
pub struct VaultPinged {
    pub slot: u64,
    pub authority: Pubkey,
}

#[event]
pub struct VaultInitialized {
    pub vault: Pubkey,
    pub usdc_mint: Pubkey,
    pub subsidy_bonus_bps: u16,
}

#[event]
pub struct DepositCommitted {
    pub leaf_index: u32,
    pub commitment: [u8; 32],
    pub new_root: [u8; 32],
    pub amount_micro_usdc: u64,
}
