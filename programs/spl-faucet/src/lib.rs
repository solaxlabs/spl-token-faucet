use anchor_lang::prelude::*;
use anchor_spl::token::{mint_to, Mint, MintTo, Token, TokenAccount};

declare_id!("GLAiyTqs45dw1Nm1WtxLYorPaE9j38EP1T3CJaf1AuQX");

#[program]
pub mod spl_faucet {
    use super::*;

    pub fn airdrop(ctx: Context<Airdrop>) -> Result<()> {
        mint_to(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.token_account.to_account_info(),
                    authority: ctx.accounts.faucet_authority.to_account_info(),
                },
            )
            .with_signer(&[&[FAUCET_AUTHORITY_PREFIX, &[ctx.bumps.faucet_authority]]]),
            100_000_000,
        )
    }
}

#[derive(Accounts)]
pub struct Airdrop<'info> {
    #[account(mut)]
    pub token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub mint: Account<'info, Mint>,

    /// CHECK: OK
    #[account(seeds = [FAUCET_AUTHORITY_PREFIX], bump)]
    pub faucet_authority: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
}

const FAUCET_AUTHORITY_PREFIX: &'static [u8] = b"Faucet Authority";
