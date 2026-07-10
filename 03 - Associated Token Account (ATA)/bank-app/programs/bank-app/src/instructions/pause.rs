use anchor_lang::prelude::*;

use crate::{constant::BANK_INFO_SEED, state::BankInfo};

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
    pub fn process(ctx: Context<Pause>, is_paused: bool) -> Result<()> {
        ctx.accounts.bank_info.is_paused = is_paused;

        msg!("Bank app paused state set to {}", is_paused);
        Ok(())
    }
}
