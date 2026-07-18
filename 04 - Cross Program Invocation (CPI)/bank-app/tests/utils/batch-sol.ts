import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { getOrCreateLookupTable } from "./lookup-table";

export interface SolTransferItem {
  to: PublicKey;
  lamports: number;
}

export async function batchSendSol(
  connection: Connection,
  payer: Keypair,
  transfers: SolTransferItem[],
  lookupTableCacheKey = "bank-app-batch-sol"
): Promise<string> {
  if (transfers.length === 0) {
    throw new Error("batchSendSol: transfers must not be empty");
  }

  const instructions: TransactionInstruction[] = transfers.map(({ to, lamports }) =>
    SystemProgram.transfer({ fromPubkey: payer.publicKey, toPubkey: to, lamports })
  );

  const touchedAccounts = [SystemProgram.programId, ...transfers.map((t) => t.to)];
  const lookupTable = await getOrCreateLookupTable(connection, payer, touchedAccounts, lookupTableCacheKey);

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  const messageV0 = new TransactionMessage({
    payerKey: payer.publicKey,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message([lookupTable]);

  const tx = new VersionedTransaction(messageV0);
  tx.sign([payer]);

  const signature = await connection.sendTransaction(tx);
  await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");
  return signature;
}

// Same as above but every transfer goes to one recipient, e.g. staggered vesting payouts
export async function batchSendSolToOne(
  connection: Connection,
  payer: Keypair,
  to: PublicKey,
  lamportsPerTransfer: number[],
  lookupTableCacheKey = "bank-app-batch-sol"
): Promise<string> {
  return batchSendSol(
    connection,
    payer,
    lamportsPerTransfer.map((lamports) => ({ to, lamports })),
    lookupTableCacheKey
  );
}
