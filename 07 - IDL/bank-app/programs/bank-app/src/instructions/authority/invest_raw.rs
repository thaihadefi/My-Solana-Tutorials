use anchor_lang::{
    prelude::*,
    solana_program::{
        instruction::{AccountMeta, Instruction},
        program::invoke_signed,
        system_program,
    },
};

use crate::{
    constant::{BANK_INFO_SEED, BANK_VAULT_SEED},
    error::BankAppError,
    state::BankInfo,
};

// sha256("global:stake")[0..8], from staking-app's idl.json
const STAKE_DISCRIMINATOR: [u8; 8] = [206, 176, 202, 18, 200, 209, 179, 108];

#[derive(Accounts)]
pub struct InvestRaw<'info> {
    #[account(
        seeds = [BANK_INFO_SEED],
        bump
    )]
    pub bank_info: Box<Account<'info, BankInfo>>,

    ///CHECK:
    #[account(
        mut,
        seeds = [BANK_VAULT_SEED],
        bump,
        owner = system_program::ID
    )]
    pub bank_vault: UncheckedAccount<'info>,

    ///CHECK:
    #[account(mut)]
    pub staking_vault: UncheckedAccount<'info>,
    ///CHECK:
    #[account(mut)]
    pub staking_info: UncheckedAccount<'info>,
    ///CHECK:
    pub staking_program: UncheckedAccount<'info>,

    #[account(mut, address = bank_info.authority)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

impl<'info> InvestRaw<'info> {
    pub fn process(ctx: Context<InvestRaw>, amount: u64, is_stake: bool) -> Result<()> {
        if ctx.accounts.bank_info.is_paused {
            return Err(BankAppError::BankAppPaused.into());
        }

        let mut data = STAKE_DISCRIMINATOR.to_vec();
        data.extend_from_slice(&amount.to_le_bytes());
        data.push(is_stake as u8);

        // order matches idl.json's stake accounts list
        let account_metas = vec![
            AccountMeta::new(ctx.accounts.staking_vault.key(), false),
            AccountMeta::new(ctx.accounts.staking_info.key(), false),
            AccountMeta::new(ctx.accounts.bank_vault.key(), true),
            AccountMeta::new(ctx.accounts.authority.key(), true),
            AccountMeta::new_readonly(ctx.accounts.system_program.key(), false),
        ];

        let instruction = Instruction {
            program_id: ctx.accounts.staking_program.key(),
            accounts: account_metas,
            data,
        };

        let vault_seeds: &[&[&[u8]]] = &[&[BANK_VAULT_SEED, &[ctx.accounts.bank_info.bump]]];

        invoke_signed(
            &instruction,
            &[
                ctx.accounts.staking_vault.to_account_info(),
                ctx.accounts.staking_info.to_account_info(),
                ctx.accounts.bank_vault.to_account_info(),
                ctx.accounts.authority.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
                ctx.accounts.staking_program.to_account_info(),
            ],
            vault_seeds,
        )?;

        Ok(())
    }
}
