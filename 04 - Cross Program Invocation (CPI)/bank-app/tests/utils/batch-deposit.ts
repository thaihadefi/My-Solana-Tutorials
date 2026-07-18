import { BN, Program } from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
  NATIVE_MINT,
} from "@solana/spl-token";
import { BankApp } from "../../target/types/bank_app";
import { getOrCreateLookupTable } from "./lookup-table";

const BANK_INFO_SEED = Buffer.from("BANK_INFO_SEED");
const BANK_VAULT_SEED = Buffer.from("BANK_VAULT_SEED");
const SHARE_MINT_SEED = Buffer.from("SHARE_MINT_SEED");
const STAKING_USER_INFO_SEED = Buffer.from("USER_INFO");

export interface BatchDepositItem {
  mint: PublicKey;
  amount: InstanceType<typeof BN>;
}

// bank-app accepts either Token or Token-2022 mints (TokenInterface on-chain), so the client
// has to check which program actually owns each mint instead of assuming TOKEN_PROGRAM_ID
async function tokenProgramForMint(connection: Connection, mint: PublicKey): Promise<PublicKey> {
  const info = await connection.getAccountInfo(mint);
  if (!info) {
    throw new Error(`Mint ${mint.toBase58()} not found`);
  }
  return info.owner;
}

// Non-native mints don't stake, exchange_rate.rs just wants bank_vault back
function stakingInfoFor(mint: PublicKey, bankVault: PublicKey, stakingProgramId: PublicKey): PublicKey {
  if (!mint.equals(NATIVE_MINT)) {
    return bankVault;
  }
  const [userInfo] = PublicKey.findProgramAddressSync(
    [STAKING_USER_INFO_SEED, bankVault.toBuffer()],
    stakingProgramId
  );
  return userInfo;
}

export async function batchDepositTokens(
  program: Program<BankApp>,
  stakingProgramId: PublicKey,
  connection: Connection,
  user: Keypair,
  items: BatchDepositItem[],
  lookupTableCacheKey = "bank-app-batch-deposit"
): Promise<string> {
  if (items.length === 0) {
    throw new Error("batchDepositTokens: items must not be empty");
  }

  const [bankInfo] = PublicKey.findProgramAddressSync([BANK_INFO_SEED], program.programId);
  const [bankVault] = PublicKey.findProgramAddressSync([BANK_VAULT_SEED], program.programId);

  const instructions: TransactionInstruction[] = [];
  const touchedAccounts: PublicKey[] = [program.programId, bankInfo, bankVault];

  for (const { mint, amount } of items) {
    const tokenProgram = await tokenProgramForMint(connection, mint);
    const userAta = getAssociatedTokenAddressSync(mint, user.publicKey, false, tokenProgram);
    const bankAta = getAssociatedTokenAddressSync(mint, bankVault, true, tokenProgram);
    const [shareMint] = PublicKey.findProgramAddressSync(
      [SHARE_MINT_SEED, mint.toBuffer()],
      program.programId
    );
    const userShareAta = getAssociatedTokenAddressSync(shareMint, user.publicKey, false, tokenProgram);
    const stakingInfo = stakingInfoFor(mint, bankVault, stakingProgramId);

    // Unlike share_mint/user_share_ata, user_ata and bank_ata aren't init_if_needed on-chain
    instructions.push(
      createAssociatedTokenAccountIdempotentInstruction(user.publicKey, userAta, user.publicKey, mint, tokenProgram),
      createAssociatedTokenAccountIdempotentInstruction(user.publicKey, bankAta, bankVault, mint, tokenProgram)
    );

    instructions.push(
      await program.methods
        .deposit(amount)
        // Custom token_program constraint breaks accounts() auto-resolve here
        .accountsPartial({
          tokenMint: mint,
          stakingInfo,
          user: user.publicKey,
          userAta,
          bankAta,
          userShareAta,
          tokenProgram,
        })
        .instruction()
    );

    touchedAccounts.push(mint, tokenProgram, userAta, bankAta, shareMint, userShareAta, stakingInfo);
  }

  const lookupTable = await getOrCreateLookupTable(connection, user, touchedAccounts, lookupTableCacheKey);

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  const messageV0 = new TransactionMessage({
    payerKey: user.publicKey,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message([lookupTable]);

  const tx = new VersionedTransaction(messageV0);
  tx.sign([user]);

  const signature = await connection.sendTransaction(tx);
  await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");
  return signature;
}
