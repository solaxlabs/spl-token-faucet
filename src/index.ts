import { Program, Provider } from "@coral-xyz/anchor";
import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { TransactionWithRecentBlock, WalletContext } from "@stabbleorg/anchor-contrib";
import { SplFaucet, IDL } from "../target/types/spl_faucet";

export class Faucet<T extends Provider> extends WalletContext<T> {
  static AUTHORITY_PREFIX = "Faucet Authority";
  readonly program: Program<SplFaucet>;

  constructor(provider: T, programId?: PublicKey) {
    super(provider);
    this.program = new Program(
      IDL,
      programId || new PublicKey("CCyXskW2kpYFHtLnJ8i8RNKJazD871iq3FhRSkbztjTm"),
      provider,
    );
  }

  get authorityAddress(): PublicKey {
    return PublicKey.findProgramAddressSync([Buffer.from(Faucet.AUTHORITY_PREFIX)], this.program.programId)[0];
  }

  findAssociatedTokenAddress(mintAddress: PublicKey): PublicKey {
    return this.getAssociatedTokenAddress(mintAddress, this.authorityAddress);
  }

  findDoneAddress(mintAddress: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
      [this.walletAddress.toBuffer(), mintAddress.toBuffer()],
      this.program.programId,
    )[0];
  }

  async claim(mintAddress: PublicKey): Promise<TransactionWithRecentBlock> {
    const instructions: TransactionInstruction[] = [];

    const userToken = await this.getOrCreateAssociatedTokenAddressInstruction(mintAddress);
    if (userToken.instruction) instructions.push(userToken.instruction);

    instructions.push(
      await this.program.methods
        .claim()
        .accounts({
          faucetToken: this.findAssociatedTokenAddress(mintAddress),
          userToken: userToken.address,
          user: this.walletAddress,
          faucetAuthority: this.authorityAddress,
          done: this.findDoneAddress(mintAddress),
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .instruction(),
    );

    return this.newTX(instructions);
  }
}
