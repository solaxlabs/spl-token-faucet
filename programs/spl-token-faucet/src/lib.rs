use anchor_lang::prelude::*;
use anchor_spl::token::{mint_to, Mint, MintTo, Token, TokenAccount};

declare_id!("GLAiyTqs45dw1Nm1WtxLYorPaE9j38EP1T3CJaf1AuQX");

#[program]
pub mod spl_token_faucet {
    use super::*;

    pub fn airdrop(ctx: Context<Airdrop>, amount: u64) -> Result<()> {
        let bump = *ctx.bumps.get("mint_authority").unwrap();

        mint_to(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.user_token_account.to_account_info(),
                    authority: ctx.accounts.mint_authority.to_account_info(),
                },
            )
            .with_signer(&[&[MINT_AUTHORITY_PREFIX, &[bump]]]),
            amount,
        )
    }
}

#[derive(Accounts)]
pub struct Airdrop<'info> {
    pub user: Signer<'info>,
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    /// CHECK: OK
    #[account(seeds = [MINT_AUTHORITY_PREFIX], bump)]
    pub mint_authority: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
}

const MINT_AUTHORITY_PREFIX: &'static [u8] = b"Faucet Authority";
