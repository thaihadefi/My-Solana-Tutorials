use anchor_lang::prelude::*;
use anchor_lang::solana_program::sysvar::instructions;

use crate::error::ErrorCode;

#[derive(Accounts)]
pub struct Execute<'info> {
    pub authority: Signer<'info>,

    /// CHECK: address constraint below confirms this is the real instructions sysvar
    #[account(address = instructions::ID)]
    pub instructions: UncheckedAccount<'info>,
}

impl<'info> Execute<'info> {
    pub fn process(ctx: Context<Execute>, amount: u64) -> Result<()> {
        let ix_sysvar = &ctx.accounts.instructions.to_account_info();
        let current = instructions::load_current_index_checked(ix_sysvar)?;
        require!(current > 0, ErrorCode::MustApproveFirst);

        let prev = instructions::load_instruction_at_checked((current - 1) as usize, ix_sysvar)?;
        require!(prev.program_id == crate::ID, ErrorCode::WrongProgram);
        require!(prev.data.len() >= 8, ErrorCode::InvalidData);
        require!(
            prev.data[0..8] == crate::instruction::Approve::DISCRIMINATOR[..],
            ErrorCode::MustApproveFirst
        );

        msg!("Executing with amount: {}", amount);
        Ok(())
    }
}
