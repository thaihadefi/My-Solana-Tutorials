use anchor_lang::prelude::*;

declare_id!("Ar5e5K3u6c7hhn3YMiHhxsJDcAGFUe5r7WVKKZ9v3fUD");

#[program]
pub mod my_first_anchor_project {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let name = "Kai";
        let age = 22;
        
        msg!("My name is {}", name);
        msg!("I'm {} years old", age);
        msg!("This is my first anchor project!");

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
