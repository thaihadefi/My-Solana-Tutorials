use anchor_lang::prelude::*;

use crate::{
    constant::REGULAR_APPROVAL_SEED,
    error::ErrorCode,
    state::LargeApprovalDataRegular,
};

#[derive(Accounts)]
pub struct ProcessLargeApprovalRegular<'info> {
    #[account(
        mut,
        seeds = [REGULAR_APPROVAL_SEED, authority.key().as_ref()],
        bump
    )]
    pub approval_data: Account<'info, LargeApprovalDataRegular>,

    pub authority: Signer<'info>,
}

impl<'info> ProcessLargeApprovalRegular<'info> {
    pub fn process(ctx: Context<ProcessLargeApprovalRegular>) -> Result<()> {
        let timestamp: u64 = Clock::get()?.unix_timestamp.try_into().unwrap();
        let approval_data = &mut ctx.accounts.approval_data;
        let slot = approval_data
            .approval_history
            .iter_mut()
            .find(|slot| **slot == 0)
            .ok_or(ErrorCode::HistoryFull)?;
        *slot = timestamp;
        Ok(())
    }
}
