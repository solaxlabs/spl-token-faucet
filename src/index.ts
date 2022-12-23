import { Program, AnchorProvider } from "@coral-xyz/anchor";
import { PublicKey, VersionedTransaction, TransactionInstruction, TransactionMessage, Cluster } from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  getAccount,
  createAssociatedTokenAccountInstruction,
  TokenAccountNotFoundError,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Token, TokenAmount } from "solax-spl-utils";
import { SplFaucet, IDL } from "../target/types/spl_faucet";

export class Faucet {
  static AUTHORITY_PREFIX = "Faucet Authority";
  readonly program: Program<SplFaucet>;

  constructor(
    readonly provider: AnchorProvider,
    readonly cluster: Cluster = "devnet",
    programId: PublicKey = new PublicKey("GLAiyTqs45dw1Nm1WtxLYorPaE9j38EP1T3CJaf1AuQX")
  ) {
    this.program = new Program(IDL, programId, provider);
  }

  get walletAddress(): PublicKey {
    return this.provider.wallet.publicKey;
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

  async getOrCreateAssociatedTokenAccountIX({
    mint,
    owner,
  }: {
    mint: PublicKey;
    owner?: PublicKey;
  }): Promise<{ address: PublicKey; instruction?: TransactionInstruction }> {
    owner = owner || this.walletAddress;

    let instruction;
    const address = getAssociatedTokenAddressSync(mint, owner, true);

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

  async airdrop({ mint, amount }: { mint: PublicKey; amount: number }): Promise<VersionedTransaction> {
    const ixs = [];

    const userToken = await this.getOrCreateAssociatedTokenAccountIX({ mint });
    if (userToken.instruction) ixs.push(userToken.instruction);

    const token = new Token({ connection: this.provider.connection, mint, cluster: this.cluster });
    const u64Amount = await TokenAmount.toU64Amount({ token, amount });
    ixs.push(
      await this.program.methods
        .airdrop(u64Amount)
        .accounts({
          userTokenAccount: userToken.address,
          mint,
          mintAuthority: this.authorityAddress,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .instruction()
    );

    return this.newTX(ixs);
  }

  async claim({ mint, amount }: { mint: PublicKey; amount: number }): Promise<VersionedTransaction> {
    const ixs = [];

    const userToken = await this.getOrCreateAssociatedTokenAccountIX({ mint });
    if (userToken.instruction) ixs.push(userToken.instruction);

    const token = new Token({ connection: this.provider.connection, mint, cluster: this.cluster });
    const u64Amount = await TokenAmount.toU64Amount({ token, amount });
    ixs.push(
      await this.program.methods
        .claim(u64Amount)
        .accounts({
          userTokenAccount: userToken.address,
          vaultTokenAccount: getAssociatedTokenAddressSync(mint, this.authorityAddress, true),
          vaultAuthority: this.authorityAddress,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .instruction()
    );

    return this.newTX(ixs);
  }
}
