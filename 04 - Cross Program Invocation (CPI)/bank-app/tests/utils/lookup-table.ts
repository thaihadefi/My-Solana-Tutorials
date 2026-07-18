import {
  AddressLookupTableAccount,
  AddressLookupTableProgram,
  Connection,
  Keypair,
  PublicKey,
  Transaction,
} from "@solana/web3.js";

// Stays under the 1232-byte tx limit per extendLookupTable call
const EXTEND_CHUNK_SIZE = 20;

// Keyed so repeated calls reuse the same ALT instead of creating a new one each time
const tableCache = new Map<string, PublicKey>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendAndConfirm(
  connection: Connection,
  payer: Keypair,
  build: (tx: Transaction) => void
): Promise<string> {
  const tx = new Transaction();
  build(tx);
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = payer.publicKey;
  tx.sign(payer);
  const signature = await connection.sendRawTransaction(tx.serialize());
  await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");
  return signature;
}

export async function getOrCreateLookupTable(
  connection: Connection,
  payer: Keypair,
  addresses: PublicKey[],
  cacheKey = "default"
): Promise<AddressLookupTableAccount> {
  let tableAddress = tableCache.get(cacheKey);

  if (!tableAddress) {
    const slot = await connection.getSlot("finalized");
    const [createIx, newTableAddress] = AddressLookupTableProgram.createLookupTable({
      authority: payer.publicKey,
      payer: payer.publicKey,
      recentSlot: slot,
    });
    await sendAndConfirm(connection, payer, (tx) => tx.add(createIx));
    tableAddress = newTableAddress;
    tableCache.set(cacheKey, tableAddress);
  }

  const existing = await connection.getAddressLookupTable(tableAddress);
  const known = new Set((existing.value?.state.addresses ?? []).map((a) => a.toBase58()));
  const missing = addresses.filter((a) => !known.has(a.toBase58()));

  if (missing.length > 0) {
    const slotBeforeExtend = await connection.getSlot();

    for (let i = 0; i < missing.length; i += EXTEND_CHUNK_SIZE) {
      const chunk = missing.slice(i, i + EXTEND_CHUNK_SIZE);
      const extendIx = AddressLookupTableProgram.extendLookupTable({
        payer: payer.publicKey,
        authority: payer.publicKey,
        lookupTable: tableAddress,
        addresses: chunk,
      });
      await sendAndConfirm(connection, payer, (tx) => tx.add(extendIx));
    }

    // Newly extended addresses only load once the slot advances, so poll instead of a fixed sleep
    while ((await connection.getSlot()) <= slotBeforeExtend) {
      await sleep(400);
    }
  }

  const result = await connection.getAddressLookupTable(tableAddress);
  if (!result.value) {
    throw new Error(`Lookup table ${tableAddress.toBase58()} not found after create/extend`);
  }
  return result.value;
}

export function clearLookupTableCache(cacheKey?: string): void {
  if (cacheKey) {
    tableCache.delete(cacheKey);
  } else {
    tableCache.clear();
  }
}
