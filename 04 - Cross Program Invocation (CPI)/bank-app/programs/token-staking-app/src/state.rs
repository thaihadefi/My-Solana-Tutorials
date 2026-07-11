use anchor_lang::prelude::*;

#[account]
#[derive(Default)]
pub struct UserInfo {
    pub amount: u64,
    pub last_update_time: u64,
}
