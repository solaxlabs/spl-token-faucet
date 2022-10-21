import { BN } from "bn.js";
import { Program, AnchorProvider } from "@project-serum/anchor";
import { Keypair, PublicKey, Transaction } from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  uiAmountToAmount,
  getAccount,
  createAssociatedTokenAccountInstruction,
  TokenAccountNotFoundError,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { SplTokenFaucet, IDL } from "../target/types/spl_token_faucet";

export class Faucet {
  readonly program: Program<SplTokenFaucet>;

  constructor(
    readonly provider: AnchorProvider,
    programId: PublicKey = new PublicKey("GLAiyTqs45dw1Nm1WtxLYorPaE9j38EP1T3CJaf1AuQX")
  ) {
    this.program = new Program(IDL, programId, provider);
  }

  get walletAddress(): PublicKey {
    return this.provider.wallet.publicKey;
  }

  get authorityAddress(): PublicKey {
    return PublicKey.findProgramAddressSync([Buffer.from("Faucet Authority")], this.program.programId)[0];
  }

  async airdrop({ mint, amount }: { mint: PublicKey; amount: string }): Promise<Transaction> {
    const tx = new Transaction();

    const tokenAccountAddress = getAssociatedTokenAddressSync(mint, this.walletAddress);
    try {
      await getAccount(this.provider.connection, tokenAccountAddress);
    } catch (err) {
      if (err instanceof TokenAccountNotFoundError) {
        tx.add(
          createAssociatedTokenAccountInstruction(this.walletAddress, tokenAccountAddress, this.walletAddress, mint)
        );
      } else {
        throw err;
      }
    }

    const amountU64 = await uiAmountToAmount(this.provider.connection, Keypair.generate(), mint, amount);

    if (amountU64 instanceof BigInt) {
      tx.add(
        await this.program.methods
          .airdrop(new BN(amountU64.toString()))
          .accounts({
            user: this.walletAddress,
            userTokenAccount: tokenAccountAddress,
            mint,
            mintAuthority: this.authorityAddress,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .instruction()
      );
    } else {
      throw Error(amountU64?.toString());
    }

    return tx;
  }
}
