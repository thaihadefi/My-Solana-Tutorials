use anchor_lang::{prelude::*, system_program};
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{self, Mint, MintTo, TokenAccount, TokenInterface},
};

use crate::{
    constant::{BANK_INFO_SEED, BANK_VAULT_SEED, SHARE_MINT_SEED},
    error::BankAppError,
    exchange_rate,
    state::BankInfo,
    transfer_helper::token_transfer_from_user,
};

#[derive(Accounts)]
pub struct Deposit<'info> {
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

    // The share token for this vault — supply doubles as total_shares issued
    #[account(
        init_if_needed,
        payer = user,
        seeds = [SHARE_MINT_SEED, token_mint.key().as_ref()],
        bump,
        mint::decimals = token_mint.decimals,
        mint::authority = bank_vault,
        mint::token_program = token_program,
    )]
    pub share_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = share_mint,
        associated_token::authority = user,
        associated_token::token_program = token_program,
    )]
    pub user_share_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(mut)]
    pub user: Signer<'info>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

impl<'info> Deposit<'info> {
    pub fn process(ctx: Context<Deposit>, deposit_amount: u64) -> Result<()> {
        if ctx.accounts.bank_info.is_paused {
            return Err(BankAppError::BankAppPaused.into());
        }
        let balance_before = ctx.accounts.bank_ata.amount;

        token_transfer_from_user(
            ctx.accounts.user_ata.to_account_info(),
            ctx.accounts.bank_ata.to_account_info(),
            ctx.accounts.token_mint.to_account_info(),
            ctx.accounts.token_mint.decimals,
            &ctx.accounts.user,
            &ctx.accounts.token_program,
            deposit_amount,
        )?;

        ctx.accounts.bank_ata.reload()?;
        let balance_after = ctx.accounts.bank_ata.amount;
        let actual_deposit_amount = balance_after.checked_sub(balance_before).ok_or(BankAppError::AmountOverflow)?;
        require!(actual_deposit_amount > 0, BankAppError::ZeroShares);

        let invested = exchange_rate::read_invested_amount(
            &ctx.accounts.staking_info.to_account_info(),
            &ctx.accounts.token_mint.key(),
            &ctx.accounts.bank_vault.key(),
        )?;
        let total_assets = balance_before.checked_add(invested).ok_or(BankAppError::AmountOverflow)?;

        let shares_to_mint = exchange_rate::shares_for_deposit(
            actual_deposit_amount,
            total_assets,
            ctx.accounts.share_mint.supply,
        )?;
        require!(shares_to_mint > 0, BankAppError::ZeroShares);

        let pda_seeds: &[&[&[u8]]] = &[&[BANK_VAULT_SEED, &[ctx.accounts.bank_info.bump]]];
        token_interface::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.share_mint.to_account_info(),
                    to: ctx.accounts.user_share_ata.to_account_info(),
                    authority: ctx.accounts.bank_vault.to_account_info(),
                },
                pda_seeds,
            ),
            shares_to_mint,
        )?;

        Ok(())
    }
}
