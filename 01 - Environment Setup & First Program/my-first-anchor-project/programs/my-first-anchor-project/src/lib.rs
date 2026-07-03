use anchor_lang::prelude::*;

declare_id!("GG4EgPuxQKiwNHMjtgFb4opBw9w1rda7H3qfcpZLCpuW");

#[program]
pub mod my_first_anchor_project {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let name = "Thai";
        let age = 21;

        msg!("My name is {}", name);
        msg!("I'm {} years old", age);
        msg!("This is my first anchor project!");

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
