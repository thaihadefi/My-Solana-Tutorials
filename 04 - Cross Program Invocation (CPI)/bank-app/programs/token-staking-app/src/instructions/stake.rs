use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::Token,
    token_interface::{Mint, TokenAccount},
};

use crate::{
    constant::{TOKEN_STAKING_VAULT_SEED, TOKEN_USER_INFO_SEED},
    error::TokenStakingError,
    state::UserInfo,
    transfer_helper::{token_transfer_from_pda, token_transfer_from_user},
};

const STAKING_APR: u64 = 5; //5%
const SECOND_PER_YEAR: u64 = 31_536_000;

#[derive(Accounts)]
pub struct Stake<'info> {
    pub token_mint: Box<InterfaceAccount<'info, Mint>>,

    /// CHECK: PDA authority for the token staking vault, holds no data of its own
    #[account(
        seeds = [TOKEN_STAKING_VAULT_SEED],
        bump
    )]
    pub staking_vault: UncheckedAccount<'info>,

    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = token_mint,
        associated_token::authority = staking_vault,
    )]
    pub staking_vault_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = token_mint,
        associated_token::authority = user,
    )]
    pub user_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        init_if_needed,
        seeds = [TOKEN_USER_INFO_SEED, user.key().as_ref(), token_mint.key().as_ref()],
        bump,
        payer = payer,
        space = 8 + std::mem::size_of::<UserInfo>(),
    )]
    pub user_info: Box<Account<'info, UserInfo>>,

    pub user: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

impl<'info> Stake<'info> {
    pub fn process(ctx: Context<Stake>, amount: u64, is_stake: bool) -> Result<()> {
        let user_info = &mut ctx.accounts.user_info;

        let current_time: u64 = Clock::get()?.unix_timestamp.try_into().unwrap();
        let pass_time = if user_info.last_update_time == 0 {
            //just initialized
            0
        } else {
            current_time - user_info.last_update_time
        };

        // u128 to avoid overflow on the multiplication
        let reward: u64 = (user_info.amount as u128 * STAKING_APR as u128 * pass_time as u128
            / 100
            / SECOND_PER_YEAR as u128)
            .try_into()
            .map_err(|_| TokenStakingError::AmountOverflow)?;
        user_info.amount = user_info
            .amount
            .checked_add(reward)
            .ok_or(TokenStakingError::AmountOverflow)?;
        user_info.last_update_time = current_time;

        if amount != 0 {
            if is_stake {
                token_transfer_from_user(
                    ctx.accounts.user_ata.to_account_info(),
                    ctx.accounts.staking_vault_ata.to_account_info(),
                    &ctx.accounts.user,
                    &ctx.accounts.token_program,
                    amount,
                )?;

                user_info.amount = user_info
                    .amount
                    .checked_add(amount)
                    .ok_or(TokenStakingError::AmountOverflow)?;
            } else {
                require!(user_info.amount >= amount, TokenStakingError::InsufficientStakedAmount);

                let pda_seeds: &[&[&[u8]]] =
                    &[&[TOKEN_STAKING_VAULT_SEED, &[ctx.bumps.staking_vault]]];

                token_transfer_from_pda(
                    ctx.accounts.staking_vault_ata.to_account_info(),
                    ctx.accounts.user_ata.to_account_info(),
                    ctx.accounts.staking_vault.to_account_info(),
                    &ctx.accounts.token_program,
                    pda_seeds,
                    amount,
                )?;

                user_info.amount -= amount;
            }
        }
        Ok(())
    }
}
