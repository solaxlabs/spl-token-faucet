import { Program, Provider } from "@coral-xyz/anchor";
import { PublicKey, VersionedTransaction, TransactionInstruction, TransactionMessage } from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  getAccount,
  createAssociatedTokenAccountInstruction,
  TokenAccountNotFoundError,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { SplFaucet, IDL } from "../target/types/spl_faucet";

export class Faucet {
  static AUTHORITY_PREFIX = "Faucet Authority";
  readonly program: Program<SplFaucet>;

  constructor(
    readonly provider: Provider,
    programId: PublicKey = new PublicKey("CCyXskW2kpYFHtLnJ8i8RNKJazD871iq3FhRSkbztjTm"),
  ) {
    this.program = new Program(IDL, programId, provider);
  }

  get walletAddress(): PublicKey {
    if (!this.provider.publicKey) throw new Error("Wallet not connected");
    return this.provider.publicKey;
  }

  get authorityAddress(): PublicKey {
    return PublicKey.findProgramAddressSync([Buffer.from(Faucet.AUTHORITY_PREFIX)], this.program.programId)[0];
  }

  async newTX(instructions: TransactionInstruction[]): Promise<VersionedTransaction> {
    const { blockhash: recentBlockhash } = await this.provider.connection.getLatestBlockhash();
    const message = new TransactionMessage({
      payerKey: this.walletAddress,
      recentBlockhash,
      instructions,
    }).compileToV0Message();
    return new VersionedTransaction(message);
  }

  async getOrCreateAssociatedTokenAccountIX(
    mintAddress: PublicKey,
  ): Promise<{ address: PublicKey; instruction?: TransactionInstruction }> {
    let instruction;
    const address = getAssociatedTokenAddressSync(mintAddress, this.walletAddress, true);

    try {
      await getAccount(this.provider.connection, address);
    } catch (err) {
      if (err instanceof TokenAccountNotFoundError) {
        instruction = createAssociatedTokenAccountInstruction(
          this.walletAddress,
          address,
          this.walletAddress,
          mintAddress,
        );
      } else {
        throw err;
      }
    }

    return { address, instruction };
  }

  async claim(mintAddress: PublicKey): Promise<VersionedTransaction> {
    const ixs = [];

    const faucetTokenAddress = getAssociatedTokenAddressSync(mintAddress, this.authorityAddress, true);
    const userToken = await this.getOrCreateAssociatedTokenAccountIX(mintAddress);
    if (userToken.instruction) ixs.push(userToken.instruction);

    ixs.push(
      await this.program.methods
        .claim()
        .accounts({
          faucetToken: faucetTokenAddress,
          userToken: userToken.address,
          user: this.walletAddress,
          faucetAuthority: this.authorityAddress,
          done: PublicKey.findProgramAddressSync(
            [this.walletAddress.toBuffer(), mintAddress.toBuffer()],
            this.program.programId,
          )[0],
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .instruction(),
    );

    return this.newTX(ixs);
  }
}
