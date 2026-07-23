use anchor_lang::prelude::*;
use anchor_lang::solana_program::{program::invoke, system_instruction};

use crate::error::ErrorCode;

#[derive(Accounts)]
pub struct MultiSend<'info> {
    /// Sender - lamport debit
    #[account(mut)]
    pub sender: Signer<'info>,

    pub system_program: Program<'info, System>,
    // recipients passed via ctx.remaining_accounts, not declared here
}

impl<'info> MultiSend<'info> {
    pub fn process(ctx: Context<'_, '_, '_, 'info, MultiSend<'info>>, amount_per_recipient: u64) -> Result<()> {
        let recipients = &ctx.remaining_accounts;

        require!(!recipients.is_empty(), ErrorCode::NoRecipients);
        require!(recipients.len() <= 10, ErrorCode::TooManyRecipients);

        for recipient in recipients.iter() {
            require!(recipient.is_writable, ErrorCode::RecipientNotWritable);

            let ix = system_instruction::transfer(
                ctx.accounts.sender.key,
                recipient.key,
                amount_per_recipient,
            );
            invoke(
                &ix,
                &[
                    ctx.accounts.sender.to_account_info(),
                    recipient.clone(),
                    ctx.accounts.system_program.to_account_info(),
                ],
            )?;
        }

        Ok(())
    }
}
