use anchor_lang::prelude::*;

use crate::{
    constant::ZERO_COPY_APPROVAL_SEED,
    error::ErrorCode,
    state::LargeApprovalData,
};

#[derive(Accounts)]
pub struct ProcessLargeApprovalZeroCopy<'info> {
    #[account(
        mut,
        seeds = [ZERO_COPY_APPROVAL_SEED, authority.key().as_ref()],
        bump
    )]
    pub approval_data: AccountLoader<'info, LargeApprovalData>,

    pub authority: Signer<'info>,
}

impl<'info> ProcessLargeApprovalZeroCopy<'info> {
    pub fn process(ctx: Context<ProcessLargeApprovalZeroCopy>) -> Result<()> {
        let timestamp: u64 = Clock::get()?.unix_timestamp.try_into().unwrap();
        let mut data = ctx.accounts.approval_data.load_mut()?;
        let slot = data
            .approval_history
            .iter_mut()
            .find(|slot| **slot == 0)
            .ok_or(ErrorCode::HistoryFull)?;
        *slot = timestamp;
        Ok(())
    }
}
