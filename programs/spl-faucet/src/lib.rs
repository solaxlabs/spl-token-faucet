use anchor_lang::prelude::*;
use anchor_spl::token::{transfer, Token, TokenAccount, Transfer};

declare_id!("CCyXskW2kpYFHtLnJ8i8RNKJazD871iq3FhRSkbztjTm");

#[program]
pub mod spl_faucet {
    use super::*;

    pub fn claim(ctx: Context<Claim>) -> Result<()> {
        ctx.accounts.done.set_inner(Done {
            user: ctx.accounts.user.key(),
            mint: ctx.accounts.user_token.mint.key(),
        });

        transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.faucet_token.to_account_info(),
                    to: ctx.accounts.user_token.to_account_info(),
                    authority: ctx.accounts.faucet_authority.to_account_info(),
                },
            )
            .with_signer(&[&[FAUCET_AUTHORITY_PREFIX, &[ctx.bumps.faucet_authority]]]),
            5_000_000_000, // 5k USDC/USDT
        )
    }
}

#[derive(Accounts)]
pub struct Claim<'info> {
    /// CHECK: OK
    #[account(mut)]
    pub faucet_token: UncheckedAccount<'info>,
    #[account(mut, constraint = user_token.owner == user.key())]
    pub user_token: Account<'info, TokenAccount>,

    /// CHECK: OK
    #[account(seeds = [FAUCET_AUTHORITY_PREFIX], bump)]
    pub faucet_authority: UncheckedAccount<'info>,
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        init, space = 72, payer = user,
        seeds = [&user.key().to_bytes(), &user_token.mint.to_bytes()], bump
    )]
    pub done: Account<'info, Done>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct Done {
    pub user: Pubkey,
    pub mint: Pubkey,
}

const FAUCET_AUTHORITY_PREFIX: &'static [u8] = b"Faucet Authority";
