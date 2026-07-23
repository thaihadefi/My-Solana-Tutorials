use anchor_lang::prelude::*;

use crate::constant::REGULAR_HISTORY_LEN;

#[account]
pub struct LargeApprovalDataRegular {
    pub authority: Pubkey,
    pub approval_history: [u64; REGULAR_HISTORY_LEN],
}

#[account(zero_copy)]
#[repr(C)]
pub struct LargeApprovalData {
    pub authority: [u8; 32],
    pub approval_history: [u64; 512],
}
