use anchor_lang::prelude::*;

#[error_code]
pub enum BankAppError {
    #[msg("The bank app is currently paused.")]
    BankAppPaused,
    #[msg("The bank app is not paused.")]
    BankAppNotPaused,
    #[msg("Insufficient deposited funds for this withdrawal.")]
    InsufficientFunds,
}
