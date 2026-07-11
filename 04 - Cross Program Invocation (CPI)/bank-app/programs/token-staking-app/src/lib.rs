use anchor_lang::prelude::*;

pub mod constant;
pub mod error;
pub mod instructions;
pub mod state;
pub mod transfer_helper;

use instructions::*;

declare_id!("2X53ywfkurj19152NjrfVRrbUsNx7PQ7FkB82yKxhKkT");

#[program]
pub mod token_staking_app {
    use super::*;

    pub fn stake(ctx: Context<Stake>, amount: u64, is_stake: bool) -> Result<()> {
        return Stake::process(ctx, amount, is_stake);
    }
}
