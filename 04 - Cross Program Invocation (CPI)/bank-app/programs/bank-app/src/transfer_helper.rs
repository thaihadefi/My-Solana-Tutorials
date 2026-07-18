use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, TokenInterface, TransferChecked};

// Uses transfer_checked (not plain transfer) so this works for both Token and Token-2022
pub fn token_transfer_from_user<'info>(
    from: AccountInfo<'info>,
    to: AccountInfo<'info>,
    mint: AccountInfo<'info>,
    decimals: u8,
    authority: &Signer<'info>,
    token_program: &Interface<'info, TokenInterface>,
    amount: u64,
) -> Result<()> {
    let cpi_ctx: CpiContext<_> = CpiContext::new(
        token_program.to_account_info(),
        TransferChecked {
            from,
            mint,
            to,
            authority: authority.to_account_info(),
        },
    );
    token_interface::transfer_checked(cpi_ctx, amount, decimals)?;
    Ok(())
}

pub fn token_transfer_from_pda<'info>(
    from: AccountInfo<'info>,
    to: AccountInfo<'info>,
    mint: AccountInfo<'info>,
    decimals: u8,
    authority: AccountInfo<'info>,
    token_program: &Interface<'info, TokenInterface>,
    pda_seeds: &[&[&[u8]]],
    amount: u64,
) -> Result<()> {
    let cpi_ctx: CpiContext<_> = CpiContext::new_with_signer(
        token_program.to_account_info(),
        TransferChecked { from, mint, to, authority },
        pda_seeds,
    );
    token_interface::transfer_checked(cpi_ctx, amount, decimals)?;

    Ok(())
}
