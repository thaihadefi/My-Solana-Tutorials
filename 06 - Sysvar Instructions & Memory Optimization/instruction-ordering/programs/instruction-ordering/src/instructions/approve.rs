use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct Approve<'info> {
    pub authority: Signer<'info>,
}

impl<'info> Approve<'info> {
    pub fn process(_ctx: Context<Approve>) -> Result<()> {
        msg!("Approval granted");
        Ok(())
    }
}
