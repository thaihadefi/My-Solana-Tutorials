use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Must approve before executing")]
    MustApproveFirst,
    #[msg("Previous instruction is from wrong program")]
    WrongProgram,
    #[msg("Previous instruction data is invalid")]
    InvalidData,
    #[msg("Approval history is full")]
    HistoryFull,
    #[msg("Must provide at least one recipient")]
    NoRecipients,
    #[msg("Too many recipients, maximum is 10")]
    TooManyRecipients,
    #[msg("Recipient account must be writable")]
    RecipientNotWritable,
}
