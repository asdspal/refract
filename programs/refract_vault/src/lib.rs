use anchor_lang::prelude::*;

pub mod verifying_key;

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
}

#[derive(Accounts)]
pub struct PingVault<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
}

#[event]
pub struct VaultPinged {
    pub slot: u64,
    pub authority: Pubkey,
}
