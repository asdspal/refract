use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use groth16_solana::groth16::Groth16Verifier;

pub mod merkle;
pub mod state;
pub mod verifying_key;
pub mod zero_hashes;

use merkle::{empty_root, insert_leaf};
use state::{MerchantAccount, NullifierRecord, ZkYieldVault, MERKLE_DEPTH, ROOT_HISTORY_SIZE};
use verifying_key::VERIFYING_KEY;

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
        let defi_yield_vault_key = ctx.accounts.defi_yield_vault.key();
        let bump = ctx.bumps.vault;

        let mut vault = ctx.accounts.vault.load_init()?;
        vault.authority = vault_key;
        vault.usdc_mint = usdc_mint_key;
        vault.liquid_vault = liquid_vault_key;
        vault.defi_yield_vault = defi_yield_vault_key;
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

    /// Verify a Groth16 BN254 proof on-chain, record the nullifier PDA, and
    /// authorize a spend-capped Runtime Key session off-chain.
    pub fn settle_zk_spend(
        ctx: Context<SettleZkSpend>,
        proof_a: [u8; 64],
        proof_b: [u8; 128],
        proof_c: [u8; 64],
        public_inputs: [[u8; 32]; 4],
        nullifier_hash: [u8; 32],
    ) -> Result<()> {
        require!(nullifier_hash == public_inputs[1], RefractError::InvalidGroth16Proof);
        let vault = ctx.accounts.vault.load()?;
        require!(
            merkle::is_known_root(&vault, &public_inputs[0]),
            RefractError::UnknownMerkleRoot
        );
        drop(vault);

        let spend_cap_micro_usdc =
            u64::from_be_bytes(public_inputs[2][24..32].try_into().unwrap());
        require!(spend_cap_micro_usdc > 0, RefractError::SpendCapZero);

        let mut verifier = Groth16Verifier::<4>::new(
            &proof_a,
            &proof_b,
            &proof_c,
            &public_inputs,
            &VERIFYING_KEY,
        )
        .map_err(|_| error!(RefractError::InvalidGroth16Proof))?;
        verifier
            .verify()
            .map_err(|_| error!(RefractError::InvalidGroth16Proof))?;

        let slot = Clock::get()?.slot;
        let record = &mut ctx.accounts.nullifier_record;
        record.nullifier_hash = nullifier_hash;
        record.spend_cap_micro_usdc = spend_cap_micro_usdc;
        record.session_pubkey_hash = public_inputs[3];
        record.spent_at_slot = slot;
        record.bump = ctx.bumps.nullifier_record;

        emit!(NullifierSpent {
            nullifier_hash,
            spend_cap_micro_usdc,
            session_pubkey_hash: public_inputs[3],
            slot,
        });
        Ok(())
    }

    /// Rebalance the vault to 90% staked / 10% liquid. The vault PDA signs the
    /// SPL token transfer between its two token accounts.
    pub fn rebalance_defi_float(ctx: Context<RebalanceDefiFloat>) -> Result<()> {
        let (bump, subsidy_bonus_bps, usdc_mint_key) = {
            let vault = ctx.accounts.vault.load()?;
            (vault.bump, vault.subsidy_bonus_bps, vault.usdc_mint)
        };

        let liquid = ctx.accounts.liquid_vault.amount;
        let staked = ctx.accounts.defi_yield_vault.amount;
        let total = liquid.checked_add(staked).ok_or(RefractError::MathOverflow)?;
        let target_staked = ((total as u128 * 9_000) / 10_000) as u64;

        let signer_seeds: &[&[u8]] =
            &[b"refract_vault", usdc_mint_key.as_ref(), &[bump]];

        let (liquid_after, staked_after) = if staked < target_staked {
            let delta = target_staked - staked;
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.key(),
                    Transfer {
                        from: ctx.accounts.liquid_vault.to_account_info(),
                        to: ctx.accounts.defi_yield_vault.to_account_info(),
                        authority: ctx.accounts.vault.to_account_info(),
                    },
                    &[signer_seeds],
                ),
                delta,
            )?;
            (
                liquid.checked_sub(delta).ok_or(RefractError::MathOverflow)?,
                target_staked,
            )
        } else if staked > target_staked {
            let delta = staked - target_staked;
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.key(),
                    Transfer {
                        from: ctx.accounts.defi_yield_vault.to_account_info(),
                        to: ctx.accounts.liquid_vault.to_account_info(),
                        authority: ctx.accounts.vault.to_account_info(),
                    },
                    &[signer_seeds],
                ),
                delta,
            )?;
            (
                liquid.checked_add(delta).ok_or(RefractError::MathOverflow)?,
                target_staked,
            )
        } else {
            (liquid, staked)
        };

        emit!(DefiFloatRebalanced {
            total_pool_micro_usdc: total,
            staked_micro_usdc: staked_after,
            liquid_micro_usdc: liquid_after,
            subsidy_bonus_bps,
        });
        Ok(())
    }

    /// Create the per-merchant revenue PDA.
    pub fn initialize_merchant(ctx: Context<InitializeMerchant>) -> Result<()> {
        let merchant = &mut ctx.accounts.merchant;
        merchant.authority = ctx.accounts.authority.key();
        merchant.usdc_mint = ctx.accounts.usdc_mint.key();
        merchant.total_revenue_micro_usdc = 0;
        merchant.defi_staked_micro_usdc = 0;
        merchant.yield_earned_micro_usdc = 0;
        merchant.bump = ctx.bumps.merchant;
        Ok(())
    }

    /// Move settled merchant revenue out of the liquid reserve.
    pub fn settle_merchant_revenue(
        ctx: Context<SettleMerchantRevenue>,
        amount_micro_usdc: u64,
    ) -> Result<()> {
        require!(amount_micro_usdc > 0, RefractError::InvalidAmount);
        let (bump, usdc_mint_key) = {
            let vault = ctx.accounts.vault.load()?;
            (vault.bump, vault.usdc_mint)
        };
        let signer_seeds: &[&[u8]] =
            &[b"refract_vault", usdc_mint_key.as_ref(), &[bump]];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                Transfer {
                    from: ctx.accounts.liquid_vault.to_account_info(),
                    to: ctx.accounts.merchant_usdc.to_account_info(),
                    authority: ctx.accounts.vault.to_account_info(),
                },
                &[signer_seeds],
            ),
            amount_micro_usdc,
        )?;

        let merchant = &mut ctx.accounts.merchant;
        merchant.total_revenue_micro_usdc = merchant
            .total_revenue_micro_usdc
            .checked_add(amount_micro_usdc)
            .ok_or(RefractError::MathOverflow)?;

        emit!(MerchantRevenueSettled {
            merchant: merchant.key(),
            amount_micro_usdc,
            total_revenue_micro_usdc: merchant.total_revenue_micro_usdc,
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

    #[account(
        init,
        payer = authority,
        token::mint = usdc_mint,
        token::authority = vault,
        seeds = [b"defi_yield_vault", vault.key().as_ref()],
        bump,
    )]
    pub defi_yield_vault: Account<'info, TokenAccount>,

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

#[derive(Accounts)]
#[instruction(proof_a: [u8; 64], proof_b: [u8; 128], proof_c: [u8; 64], public_inputs: [[u8; 32]; 4], nullifier_hash: [u8; 32])]
pub struct SettleZkSpend<'info> {
    #[account(
        seeds = [b"refract_vault", usdc_mint.key().as_ref()],
        bump,
    )]
    pub vault: AccountLoader<'info, ZkYieldVault>,

    pub usdc_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = relayer,
        space = NullifierRecord::LEN,
        seeds = [b"nullifier", nullifier_hash.as_ref()],
        bump,
    )]
    pub nullifier_record: Account<'info, NullifierRecord>,

    #[account(mut)]
    pub relayer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RebalanceDefiFloat<'info> {
    #[account(
        seeds = [b"refract_vault", usdc_mint.key().as_ref()],
        bump,
    )]
    pub vault: AccountLoader<'info, ZkYieldVault>,

    pub usdc_mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [b"liquid_vault", vault.key().as_ref()],
        bump,
        token::authority = vault,
    )]
    pub liquid_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"defi_yield_vault", vault.key().as_ref()],
        bump,
        token::authority = vault,
    )]
    pub defi_yield_vault: Account<'info, TokenAccount>,

    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct InitializeMerchant<'info> {
    #[account(
        init,
        payer = authority,
        space = MerchantAccount::LEN,
        seeds = [b"merchant", authority.key().as_ref()],
        bump,
    )]
    pub merchant: Account<'info, MerchantAccount>,

    pub usdc_mint: Account<'info, Mint>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SettleMerchantRevenue<'info> {
    #[account(
        seeds = [b"refract_vault", usdc_mint.key().as_ref()],
        bump,
    )]
    pub vault: AccountLoader<'info, ZkYieldVault>,

    pub usdc_mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [b"liquid_vault", vault.key().as_ref()],
        bump,
        token::authority = vault,
    )]
    pub liquid_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"merchant", authority.key().as_ref()],
        bump,
        constraint = merchant.authority == authority.key() @ RefractError::InvalidMerchant,
    )]
    pub merchant: Account<'info, MerchantAccount>,

    #[account(
        mut,
        token::mint = usdc_mint,
        token::authority = authority,
    )]
    pub merchant_usdc: Account<'info, TokenAccount>,

    pub authority: Signer<'info>,
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
    #[msg("Invalid merchant account")]
    InvalidMerchant,
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

#[event]
pub struct NullifierSpent {
    pub nullifier_hash: [u8; 32],
    pub spend_cap_micro_usdc: u64,
    pub session_pubkey_hash: [u8; 32],
    pub slot: u64,
}

#[event]
pub struct DefiFloatRebalanced {
    pub total_pool_micro_usdc: u64,
    pub staked_micro_usdc: u64,
    pub liquid_micro_usdc: u64,
    pub subsidy_bonus_bps: u16,
}

#[event]
pub struct MerchantRevenueSettled {
    pub merchant: Pubkey,
    pub amount_micro_usdc: u64,
    pub total_revenue_micro_usdc: u64,
}
