use anchor_lang::prelude::*;

#[error_code]
pub enum TokenStakingError {
    #[msg("Insufficient staked amount for this unstake.")]
    InsufficientStakedAmount,
    #[msg("Amount overflowed.")]
    AmountOverflow,
}
