use anchor_lang::prelude::*;

pub mod constant;
pub mod error;
pub mod instructions;
pub mod state;
pub mod transfer_helper;

use instructions::*;

declare_id!("5uQAmCGoSjQfRDgiVtHCKMGLSHoh1cF31KCy3vydaSMD");

#[program]
pub mod staking_app {
    use super::*;

    pub fn stake(ctx: Context<Stake>, amount: u64, is_stake: bool) -> Result<()> {
        return Stake::process(ctx, amount, is_stake);
    }
}
