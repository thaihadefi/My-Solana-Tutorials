use anchor_lang::prelude::*;

use crate::{
    constant::{REGULAR_APPROVAL_SEED, REGULAR_HISTORY_LEN},
    state::LargeApprovalDataRegular,
};

#[derive(Accounts)]
pub struct InitializeLargeApprovalRegular<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + std::mem::size_of::<LargeApprovalDataRegular>(),
        seeds = [REGULAR_APPROVAL_SEED, authority.key().as_ref()],
        bump
    )]
    pub approval_data: Account<'info, LargeApprovalDataRegular>,

    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

impl<'info> InitializeLargeApprovalRegular<'info> {
    pub fn process(ctx: Context<InitializeLargeApprovalRegular>) -> Result<()> {
        let approval_data = &mut ctx.accounts.approval_data;
        approval_data.authority = ctx.accounts.authority.key();
        approval_data.approval_history = [0u64; REGULAR_HISTORY_LEN];
        Ok(())
    }
}
