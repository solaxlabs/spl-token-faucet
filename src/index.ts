import BN from "bn.js";
import { Program, AnchorProvider } from "@project-serum/anchor";
import { PublicKey, VersionedTransaction, TransactionInstruction, TransactionMessage } from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  getAccount,
  getMint,
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

  async newVersionedTX(instructions: TransactionInstruction[]): Promise<VersionedTransaction> {
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

  async getU64Amount({ mint, amount }: { mint: PublicKey; amount: number }): Promise<BN> {
    const mintInfo = await getMint(this.provider.connection, mint);
    return new BN(Math.trunc(amount * 1e4)).mul(new BN(10).pow(new BN(mintInfo.decimals))).divn(1e4);
  }

  async airdrop({ mint, amount }: { mint: PublicKey; amount: number }): Promise<VersionedTransaction> {
    const ixs = [];

    const userToken = await this.getOrCreateAssociatedTokenAccountIX({ mint });
    if (userToken.instruction) ixs.push(userToken.instruction);

    const u64Amount = await this.getU64Amount({ mint, amount });
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

    return this.newVersionedTX(ixs);
  }

  async claim({ mint, amount }: { mint: PublicKey; amount: number }): Promise<VersionedTransaction> {
    const ixs = [];

    const userToken = await this.getOrCreateAssociatedTokenAccountIX({ mint });
    if (userToken.instruction) ixs.push(userToken.instruction);

    const u64Amount = await this.getU64Amount({ mint, amount });
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

    return this.newVersionedTX(ixs);
  }
}
