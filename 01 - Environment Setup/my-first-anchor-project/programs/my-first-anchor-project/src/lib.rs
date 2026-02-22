use anchor_lang::prelude::*;

declare_id!("ANDFGArhnxYWFMTb9BYNfyP3JBS1CcbHWWi1Ck83i6PZ");

#[program]
pub mod my_first_anchor_project {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
