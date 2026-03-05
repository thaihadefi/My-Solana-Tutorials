use anchor_lang::prelude::*;

declare_id!("2FAwQf428jwHtA1bsAwYmkFnkrbELj6gUkQssZUrzrMZ");

#[program]
pub mod my_first_anchor_project {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        // msg!("Hello World");
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
