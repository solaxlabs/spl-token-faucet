import { BN } from "bn.js";
import { Program, AnchorProvider } from "@project-serum/anchor";
import { Keypair, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
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

  async getOrCreateAssociatedTokenAccountIX({
    mint,
    owner,
  }: {
    mint: PublicKey;
    owner?: PublicKey;
  }): Promise<{ address: PublicKey; instruction?: TransactionInstruction }> {
    owner = owner || this.walletAddress;

    let instruction;
    const address = getAssociatedTokenAddressSync(mint, owner);

    try {
      await getAccount(this.provider.connection, address);
    } catch (err) {
      if (err instanceof TokenAccountNotFoundError) {
        instruction = createAssociatedTokenAccountInstruction(this.walletAddress, address, owner, mint);
      } else {
        throw err;
      }
    }

    return { address, instruction };
  }

  async airdrop({ mint, amount }: { mint: PublicKey; amount: string }): Promise<Transaction> {
    const tx = new Transaction();

    const amountU64 = await uiAmountToAmount(this.provider.connection, Keypair.generate(), mint, amount);
    const userToken = await this.getOrCreateAssociatedTokenAccountIX({ mint });

    if (userToken.instruction) tx.add(userToken.instruction);

    if (amountU64 instanceof BigInt) {
      tx.add(
        await this.program.methods
          .airdrop(new BN(amountU64.toString()))
          .accounts({
            userTokenAccount: userToken.address,
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

  async claim({ mint, amount }: { mint: PublicKey; amount: string }): Promise<Transaction> {
    const tx = new Transaction();

    const amountU64 = await uiAmountToAmount(this.provider.connection, Keypair.generate(), mint, amount);
    const userToken = await this.getOrCreateAssociatedTokenAccountIX({ mint });

    if (userToken.instruction) tx.add(userToken.instruction);

    if (amountU64 instanceof BigInt) {
      tx.add(
        await this.program.methods
          .claim(new BN(amountU64.toString()))
          .accounts({
            userTokenAccount: userToken.address,
            vaultTokenAccount: getAssociatedTokenAddressSync(mint, this.authorityAddress),
            vaultAuthority: this.authorityAddress,
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
