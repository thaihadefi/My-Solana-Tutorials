use anchor_lang::prelude::*;

#[error_code]
pub enum BankAppError {
    #[msg("The bank app is currently paused.")]
    BankAppPaused,
    #[msg("The bank app is not paused.")]
    BankAppNotPaused,
    #[msg("Insufficient deposited funds for this withdrawal.")]
    InsufficientFunds,
    #[msg("The bank vault does not hold enough liquid funds for this withdrawal; some funds are invested.")]
    InsufficientLiquidity,
    #[msg("Amount overflowed.")]
    AmountOverflow,
    #[msg("Deposit amount is too small to mint any shares.")]
    ZeroShares,
    #[msg("Unexpected staking info account for this mint.")]
    InvalidStakingInfoAccount,
}
