use anchor_lang::prelude::*;

pub mod constant;
pub mod error;
pub mod instructions;
pub mod state;
pub mod transfer_helper;

use instructions::*;

declare_id!("Ctjse4CJqH8n2Y2LskYPKCq7LJTocSyuucJ1Y75wisup");

#[program]
pub mod bank_app {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        return Initialize::process(ctx);
    }

    pub fn invest(ctx: Context<Invest>, amount: u64, is_stake: bool) -> Result<()> {
        return Invest::process(ctx, amount, is_stake);
    }

    pub fn invest_token(ctx: Context<InvestToken>, amount: u64, is_stake: bool) -> Result<()> {
        return InvestToken::process(ctx, amount, is_stake);
    }

    pub fn deposit(ctx: Context<Deposit>, deposit_amount: u64) -> Result<()> {
        return Deposit::process(ctx, deposit_amount);
    }

    pub fn withdraw(ctx: Context<Withdraw>, withdraw_amount: u64) -> Result<()> {
        return Withdraw::process(ctx, withdraw_amount);
    }

    pub fn pause(ctx: Context<Pause>) -> Result<()> {
        return Pause::pause(ctx);
    }

    pub fn unpause(ctx: Context<Pause>) -> Result<()> {
        return Pause::unpause(ctx);
    }
}
