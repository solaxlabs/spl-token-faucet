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
    programId: PublicKey = new PublicKey("GLAiyTqs45dw1Nm1WtxLYorPaE9j38EP1T3CJaf1AuQX"),
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
    }).compileToLegacyMessage();
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

  async airdrop(mintAddress: PublicKey): Promise<VersionedTransaction> {
    const ixs = [];

    const userToken = await this.getOrCreateAssociatedTokenAccountIX(mintAddress);
    if (userToken.instruction) ixs.push(userToken.instruction);

    ixs.push(
      await this.program.methods
        .airdrop()
        .accounts({
          tokenAccount: userToken.address,
          mint: mintAddress,
          faucetAuthority: this.authorityAddress,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .instruction(),
    );

    return this.newTX(ixs);
  }
}
