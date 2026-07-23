use anchor_lang::prelude::*;

pub mod constant;
pub mod error;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("2PYviKqx4r9uJi97quRzAR8zxyxEU59PXwiBSzjFP1Xy");

#[program]
pub mod exercise {
    use super::*;

    // ---------------- Part 1: Instruction Ordering ----------------
    pub fn approve(ctx: Context<Approve>) -> Result<()> {
        Approve::process(ctx)
    }

    pub fn execute(ctx: Context<Execute>, amount: u64) -> Result<()> {
        Execute::process(ctx, amount)
    }

    // ---------------- Part 2: Large Data – Regular vs Zero-Copy ----------------
    pub fn initialize_large_approval_regular(
        ctx: Context<InitializeLargeApprovalRegular>,
    ) -> Result<()> {
        InitializeLargeApprovalRegular::process(ctx)
    }

    pub fn process_large_approval_regular(ctx: Context<ProcessLargeApprovalRegular>) -> Result<()> {
        ProcessLargeApprovalRegular::process(ctx)
    }

    pub fn initialize_large_approval_zero_copy(
        ctx: Context<InitializeLargeApprovalZeroCopy>,
    ) -> Result<()> {
        InitializeLargeApprovalZeroCopy::process(ctx)
    }

    pub fn process_large_approval_zero_copy(
        ctx: Context<ProcessLargeApprovalZeroCopy>,
    ) -> Result<()> {
        ProcessLargeApprovalZeroCopy::process(ctx)
    }

    // ---------------- Part 3: Remaining Accounts ----------------
    pub fn multi_send<'info>(
        ctx: Context<'_, '_, '_, 'info, MultiSend<'info>>,
        amount_per_recipient: u64,
    ) -> Result<()> {
        MultiSend::process(ctx, amount_per_recipient)
    }
}
