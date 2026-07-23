use anchor_lang::prelude::*;

#[constant]
pub const REGULAR_APPROVAL_SEED: &[u8] = b"APPROVAL_REGULAR";
pub const ZERO_COPY_APPROVAL_SEED: &[u8] = b"APPROVAL_ZERO_COPY";
// Actually breaks somewhere between 4000 and 5000. 128 is just safely below that
pub const REGULAR_HISTORY_LEN: usize = 128;
