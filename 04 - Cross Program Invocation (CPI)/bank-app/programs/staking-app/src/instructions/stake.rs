use anchor_lang::{prelude::*, system_program};

use crate::{
    constant::{STAKING_VAULT_SEED, USER_INFO_SEED},
    error::StakingError,
    state::UserInfo,
    transfer_helper::{sol_transfer_from_pda, sol_transfer_from_user},
};

const STAKING_APR: u64 = 5000; //5000%
const SECOND_PER_YEAR: u64 = 31_536_000;

#[derive(Accounts)]
pub struct Stake<'info> {
    /// CHECK:
    #[account(
        init_if_needed,
        payer = payer,
        seeds = [STAKING_VAULT_SEED],
        bump,
        space = 0,
        owner = system_program::ID
    )]
    pub staking_vault: UncheckedAccount<'info>,

    #[account(
        init_if_needed,
        seeds = [USER_INFO_SEED, user.key().as_ref()],
        bump,
        payer = payer,
        space = 8 + std::mem::size_of::<UserInfo>(),
    )]
    pub user_info: Box<Account<'info, UserInfo>>,

    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

impl<'info> Stake<'info> {
    pub fn process(ctx: Context<Stake>, amount: u64, is_stake: bool) -> Result<()> {
        let user_info = &mut ctx.accounts.user_info;

        let current_time: u64 = Clock::get()?.unix_timestamp.try_into().unwrap();
        let just_initialized = user_info.last_update_time == 0;
        let pass_time = if just_initialized {
            0
        } else {
            current_time - user_info.last_update_time
        };

        // u128 to avoid overflow on the multiplication
        let reward: u64 = (user_info.amount as u128 * STAKING_APR as u128 * pass_time as u128
            / 100
            / SECOND_PER_YEAR as u128)
            .try_into()
            .map_err(|_| StakingError::AmountOverflow)?;
        user_info.amount = user_info.amount.checked_add(reward).ok_or(StakingError::AmountOverflow)?;

        // Only advance clock when rewards are accrued to prevent rounding loss
        if just_initialized || reward > 0 {
            user_info.last_update_time = current_time;
        }

        if amount != 0 {
            if is_stake {
                sol_transfer_from_user(
                    &ctx.accounts.user,
                    ctx.accounts.staking_vault.to_account_info(),
                    &ctx.accounts.system_program,
                    amount,
                )?;

                user_info.amount = user_info.amount.checked_add(amount).ok_or(StakingError::AmountOverflow)?;
            } else {
                require!(user_info.amount >= amount, StakingError::InsufficientStakedAmount);

                let pda_seeds: &[&[&[u8]]] = &[&[STAKING_VAULT_SEED, &[ctx.bumps.staking_vault]]];

                sol_transfer_from_pda(
                    ctx.accounts.staking_vault.to_account_info(),
                    ctx.accounts.user.to_account_info(),
                    &ctx.accounts.system_program,
                    pda_seeds,
                    amount,
                )?;

                user_info.amount = user_info.amount.checked_sub(amount).ok_or(StakingError::AmountOverflow)?;
            }
        }
        Ok(())
    }
}
