use anchor_lang::prelude::*;
use anchor_spl::token::spl_token::native_mint;

use crate::error::BankAppError;

/// Staked balance (principal + interest) of bank_vault for `token_mint`, 0 if never invested
pub fn read_invested_amount(
    staking_info: &AccountInfo,
    token_mint: &Pubkey,
    bank_vault: &Pubkey,
) -> Result<u64> {
    let is_native = *token_mint == native_mint::ID;
    let expected_key = if is_native {
        Pubkey::find_program_address(&[b"USER_INFO", bank_vault.as_ref()], &staking_app::ID).0
    } else {
        *bank_vault
    };

    require_keys_eq!(
        staking_info.key(),
        expected_key,
        BankAppError::InvalidStakingInfoAccount
    );

    if !is_native {
        return Ok(0);
    }

    if staking_info.data_is_empty() {
        return Ok(0);
    }

    require_keys_eq!(
        *staking_info.owner,
        staking_app::ID,
        BankAppError::InvalidStakingInfoAccount
    );

    let data = staking_info.try_borrow_data()?;
    let mut slice: &[u8] = &data;
    let amount = staking_app::state::UserInfo::try_deserialize(&mut slice)?.amount;
    Ok(amount)
}

/// assets -> shares to mint on deposit (floors, vault-favoring)
pub fn shares_for_deposit(assets: u64, total_assets: u64, total_shares: u64) -> Result<u64> {
    if total_shares == 0 || total_assets == 0 {
        return Ok(assets);
    }
    let shares = (assets as u128)
        .checked_mul(total_shares as u128)
        .and_then(|v| v.checked_div(total_assets as u128))
        .ok_or(BankAppError::AmountOverflow)?;
    shares.try_into().map_err(|_| BankAppError::AmountOverflow.into())
}

/// assets -> shares to burn on withdraw (ceils, vault-favoring)
pub fn shares_for_withdraw(assets: u64, total_assets: u64, total_shares: u64) -> Result<u64> {
    require!(
        total_shares > 0 && total_assets > 0,
        BankAppError::InsufficientFunds
    );
    let numerator = (assets as u128)
        .checked_mul(total_shares as u128)
        .ok_or(BankAppError::AmountOverflow)?;
    let shares = numerator
        .checked_add(total_assets as u128 - 1)
        .and_then(|v| v.checked_div(total_assets as u128))
        .ok_or(BankAppError::AmountOverflow)?;
    shares.try_into().map_err(|_| BankAppError::AmountOverflow.into())
}
