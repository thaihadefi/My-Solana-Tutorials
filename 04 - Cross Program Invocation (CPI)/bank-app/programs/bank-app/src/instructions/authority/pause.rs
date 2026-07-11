use anchor_lang::prelude::*;

use crate::{constant::BANK_INFO_SEED, error::BankAppError, state::BankInfo};

#[derive(Accounts)]
pub struct Pause<'info> {
    #[account(
        mut,
        seeds = [BANK_INFO_SEED],
        bump,
    )]
    pub bank_info: Box<Account<'info, BankInfo>>,

    #[account(address = bank_info.authority)]
    pub authority: Signer<'info>,
}

impl<'info> Pause<'info> {
    pub fn pause(ctx: Context<Pause>) -> Result<()> {
        require!(
            !ctx.accounts.bank_info.is_paused,
            BankAppError::BankAppPaused
        );

        ctx.accounts.bank_info.is_paused = true;

        msg!("Bank app paused");
        Ok(())
    }

    pub fn unpause(ctx: Context<Pause>) -> Result<()> {
        require!(
            ctx.accounts.bank_info.is_paused,
            BankAppError::BankAppNotPaused
        );

        ctx.accounts.bank_info.is_paused = false;

        msg!("Bank app unpaused");
        Ok(())
    }
}
