use anchor_lang::{prelude::*, system_program};
use anchor_spl::{
    associated_token::{self, AssociatedToken},
    token::{self, CloseAccount, SyncNative, Token},
    token_interface::{Mint, TokenAccount},
};

use crate::{
    constant::{BANK_INFO_SEED, BANK_VAULT_SEED},
    error::BankAppError,
    state::BankInfo,
};
use staking_app::{cpi, program::StakingApp};

#[derive(Accounts)]
pub struct Invest<'info> {
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

    #[account(address = anchor_spl::token::spl_token::native_mint::ID)]
    pub wsol_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        mut,
        associated_token::mint = wsol_mint,
        associated_token::authority = bank_vault
    )]
    pub bank_wsol_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    ///CHECK:
    #[account(mut)]
    pub staking_vault: UncheckedAccount<'info>,
    ///CHECK:
    #[account(mut)]
    pub staking_info: UncheckedAccount<'info>,
    pub staking_program: Program<'info, StakingApp>,

    #[account(mut, address = bank_info.authority)]
    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

impl<'info> Invest<'info> {
    pub fn process(ctx: Context<Invest>, amount: u64, is_stake: bool) -> Result<()> {
        if ctx.accounts.bank_info.is_paused {
            return Err(BankAppError::BankAppPaused.into());
        }

        let pda_seeds: &[&[&[u8]]] = &[&[BANK_VAULT_SEED, &[ctx.accounts.bank_info.bump]]];

        if is_stake && amount != 0 {
            // Leave the rest wrapped so withdraw() still has liquidity
            let remaining = ctx
                .accounts
                .bank_wsol_ata
                .amount
                .checked_sub(amount)
                .ok_or(BankAppError::InsufficientFunds)?;

            token::close_account(CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                CloseAccount {
                    account: ctx.accounts.bank_wsol_ata.to_account_info(),
                    destination: ctx.accounts.bank_vault.to_account_info(),
                    authority: ctx.accounts.bank_vault.to_account_info(),
                },
                pda_seeds,
            ))?;

            // Recreate even if remaining == 0 so the ATA is never left missing
            Self::rewrap(&ctx, pda_seeds, remaining)?;
        }

        cpi::stake(
            CpiContext::new_with_signer(
                ctx.accounts.staking_program.to_account_info(),
                cpi::accounts::Stake {
                    staking_vault: ctx.accounts.staking_vault.to_account_info(),
                    user_info: ctx.accounts.staking_info.to_account_info(),
                    user: ctx.accounts.bank_vault.to_account_info(),
                    payer: ctx.accounts.authority.to_account_info(),
                    system_program: ctx.accounts.system_program.to_account_info(),
                },
                pda_seeds,
            ),
            amount,
            is_stake,
        )?;

        if !is_stake && amount != 0 {
            // Re-wrap what the unstake CPI just returned
            Self::rewrap(&ctx, pda_seeds, amount)?;
        }

        Ok(())
    }

    fn rewrap(ctx: &Context<Invest>, pda_seeds: &[&[&[u8]]], amount: u64) -> Result<()> {
        // bank_vault self-funds the rent — it just got it back from the close
        associated_token::create_idempotent(CpiContext::new_with_signer(
            ctx.accounts.associated_token_program.to_account_info(),
            associated_token::Create {
                payer: ctx.accounts.bank_vault.to_account_info(),
                associated_token: ctx.accounts.bank_wsol_ata.to_account_info(),
                authority: ctx.accounts.bank_vault.to_account_info(),
                mint: ctx.accounts.wsol_mint.to_account_info(),
                system_program: ctx.accounts.system_program.to_account_info(),
                token_program: ctx.accounts.token_program.to_account_info(),
            },
            pda_seeds,
        ))?;

        system_program::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.bank_vault.to_account_info(),
                    to: ctx.accounts.bank_wsol_ata.to_account_info(),
                },
                pda_seeds,
            ),
            amount,
        )?;

        token::sync_native(CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            SyncNative {
                account: ctx.accounts.bank_wsol_ata.to_account_info(),
            },
        ))?;

        Ok(())
    }
}
