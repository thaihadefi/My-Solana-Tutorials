use anchor_lang::{prelude::*, system_program};
use anchor_spl::token_interface::{self, Burn, Mint, TokenAccount, TokenInterface};

use crate::{
    constant::{BANK_INFO_SEED, BANK_VAULT_SEED, SHARE_MINT_SEED},
    error::BankAppError,
    exchange_rate,
    state::BankInfo,
    transfer_helper::token_transfer_from_pda,
};

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(
        seeds = [BANK_INFO_SEED],
        bump
    )]
    pub bank_info: Box<Account<'info, BankInfo>>,

    ///CHECK:
    #[account(
        mut,
        seeds = [BANK_VAULT_SEED],
        bump,
        owner = system_program::ID
    )]
    pub bank_vault: UncheckedAccount<'info>,

    pub token_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = user,
        associated_token::token_program = token_program,
    )]
    pub user_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = bank_vault,
        associated_token::token_program = token_program,
    )]
    pub bank_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    /// CHECK: validated in `process`
    pub staking_info: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [SHARE_MINT_SEED, token_mint.key().as_ref()],
        bump,
    )]
    pub share_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        mut,
        associated_token::mint = share_mint,
        associated_token::authority = user,
        associated_token::token_program = token_program,
    )]
    pub user_share_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    pub user: Signer<'info>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

impl<'info> Withdraw<'info> {
    pub fn process(ctx: Context<Withdraw>, withdraw_amount: u64) -> Result<()> {
        if ctx.accounts.bank_info.is_paused {
            return Err(BankAppError::BankAppPaused.into());
        }
        require!(withdraw_amount > 0, BankAppError::ZeroShares);

        let invested = exchange_rate::read_invested_amount(
            &ctx.accounts.staking_info.to_account_info(),
            &ctx.accounts.token_mint.key(),
            &ctx.accounts.bank_vault.key(),
        )?;
        let total_assets = ctx.accounts.bank_ata.amount.checked_add(invested).ok_or(BankAppError::AmountOverflow)?;

        let shares_needed = exchange_rate::shares_for_withdraw(
            withdraw_amount,
            total_assets,
            ctx.accounts.share_mint.supply,
        )?;
        // Check shares before liquidity, so over-withdraw reports InsufficientFunds
        require!(
            ctx.accounts.user_share_ata.amount >= shares_needed,
            BankAppError::InsufficientFunds
        );
        require!(
            ctx.accounts.bank_ata.amount >= withdraw_amount,
            BankAppError::InsufficientLiquidity
        );

        let pda_seeds: &[&[&[u8]]] = &[&[BANK_VAULT_SEED, &[ctx.accounts.bank_info.bump]]];

        token_transfer_from_pda(
            ctx.accounts.bank_ata.to_account_info(),
            ctx.accounts.user_ata.to_account_info(),
            ctx.accounts.token_mint.to_account_info(),
            ctx.accounts.token_mint.decimals,
            ctx.accounts.bank_vault.to_account_info(),
            &ctx.accounts.token_program,
            pda_seeds,
            withdraw_amount,
        )?;

        token_interface::burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Burn {
                    mint: ctx.accounts.share_mint.to_account_info(),
                    from: ctx.accounts.user_share_ata.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            shares_needed,
        )?;

        Ok(())
    }
}
