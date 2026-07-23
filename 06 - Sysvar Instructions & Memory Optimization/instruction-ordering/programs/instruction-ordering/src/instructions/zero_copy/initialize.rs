use anchor_lang::prelude::*;

use crate::{
    constant::ZERO_COPY_APPROVAL_SEED,
    state::LargeApprovalData,
};

#[derive(Accounts)]
pub struct InitializeLargeApprovalZeroCopy<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + std::mem::size_of::<LargeApprovalData>(),
        seeds = [ZERO_COPY_APPROVAL_SEED, authority.key().as_ref()],
        bump
    )]
    pub approval_data: AccountLoader<'info, LargeApprovalData>,

    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

impl<'info> InitializeLargeApprovalZeroCopy<'info> {
    pub fn process(ctx: Context<InitializeLargeApprovalZeroCopy>) -> Result<()> {
        let mut approval_data = ctx.accounts.approval_data.load_init()?;
        approval_data.authority = ctx.accounts.authority.key().to_bytes();
        approval_data.approval_history = [0u64; 512];
        Ok(())
    }
}
