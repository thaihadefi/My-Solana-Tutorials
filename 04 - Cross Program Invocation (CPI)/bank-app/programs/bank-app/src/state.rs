use anchor_lang::prelude::*;

#[account]
#[derive(Default)]
pub struct BankInfo {
    pub authority: Pubkey,
    pub is_paused: bool,
    pub bump: u8,
}
