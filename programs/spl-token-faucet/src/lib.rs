use anchor_lang::prelude::*;
use anchor_spl::token::{mint_to, transfer, Mint, MintTo, Token, TokenAccount, Transfer};

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
            .with_signer(&[&[FAUCET_AUTHORITY_PREFIX, &[bump]]]),
            amount,
        )
    }

    pub fn claim(ctx: Context<Claim>, amount: u64) -> Result<()> {
        let bump = *ctx.bumps.get("vault_authority").unwrap();

        transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault_token_account.to_account_info(),
                    to: ctx.accounts.user_token_account.to_account_info(),
                    authority: ctx.accounts.vault_authority.to_account_info(),
                },
            )
            .with_signer(&[&[FAUCET_AUTHORITY_PREFIX, &[bump]]]),
            amount,
        )
    }
}

#[derive(Accounts)]
pub struct Airdrop<'info> {
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    /// CHECK: OK
    #[account(seeds = [FAUCET_AUTHORITY_PREFIX], bump)]
    pub mint_authority: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Claim<'info> {
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub vault_token_account: Account<'info, TokenAccount>,
    /// CHECK: OK
    #[account(seeds = [FAUCET_AUTHORITY_PREFIX], bump)]
    pub vault_authority: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
}

const FAUCET_AUTHORITY_PREFIX: &'static [u8] = b"Faucet Authority";
