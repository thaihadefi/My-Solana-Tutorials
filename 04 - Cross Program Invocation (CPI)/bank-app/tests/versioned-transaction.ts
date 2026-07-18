import * as anchor from "@coral-xyz/anchor";
import { BN, Program } from "@coral-xyz/anchor";
import { BankApp } from "../target/types/bank_app";
import { StakingApp } from "../target/types/staking_app";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createSyncNativeInstruction,
  getAssociatedTokenAddressSync,
  NATIVE_MINT,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { assert } from "chai";
import { batchDepositTokens } from "./utils/batch-deposit";
import { batchSendSol } from "./utils/batch-sol";
import { clearLookupTableCache } from "./utils/lookup-table";

describe("versioned-transaction", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.BankApp as Program<BankApp>;
  const stakingProgram = anchor.workspace.StakingApp as Program<StakingApp>;

  // Same devnet SPL token the other bank-app tests use
  const TOKEN_MINT = new PublicKey("7eeyDsUYHQd4RftTPfw9Zu37eDcicbdtcZ3oHRgaw4MM");

  const BANK_APP_ACCOUNTS = {
    bankVault: PublicKey.findProgramAddressSync(
      [Buffer.from("BANK_VAULT_SEED")],
      program.programId
    )[0],
    shareMint: (tokenMint: PublicKey) =>
      PublicKey.findProgramAddressSync(
        [Buffer.from("SHARE_MINT_SEED"), tokenMint.toBuffer()],
        program.programId
      )[0],
  };

  const fetchShareBalance = async (mint: PublicKey, owner: PublicKey): Promise<InstanceType<typeof BN>> => {
    const ata = getAssociatedTokenAddressSync(BANK_APP_ACCOUNTS.shareMint(mint), owner);
    try {
      return new BN((await provider.connection.getTokenAccountBalance(ata)).value.amount);
    } catch {
      return new BN(0); // share ATA not created yet
    }
  };

  // Wraps SOL into the signer's own wSOL ATA, needed before wSOL can be deposited
  const wrapSol = async (owner: Keypair, amount: number) => {
    const ownerWsolAta = getAssociatedTokenAddressSync(NATIVE_MINT, owner.publicKey);
    const tx = new Transaction().add(
      createAssociatedTokenAccountIdempotentInstruction(owner.publicKey, ownerWsolAta, owner.publicKey, NATIVE_MINT),
      SystemProgram.transfer({ fromPubkey: owner.publicKey, toPubkey: ownerWsolAta, lamports: amount }),
      createSyncNativeInstruction(ownerWsolAta)
    );
    await provider.sendAndConfirm(tx, [owner]);
  };

  before(() => {
    // Each test below uses its own cache key anyway, this just resets between full runs
    clearLookupTableCache();
  });

  it("Batch-deposits wSOL + an SPL token in a single versioned transaction", async () => {
    const beforeWsolShares = await fetchShareBalance(NATIVE_MINT, provider.publicKey);
    const beforeTokenShares = await fetchShareBalance(TOKEN_MINT, provider.publicKey);

    await wrapSol(provider.wallet.payer, 2_000_000);

    const signature = await batchDepositTokens(
      program,
      stakingProgram.programId,
      provider.connection,
      provider.wallet.payer,
      [
        { mint: NATIVE_MINT, amount: new BN(1_000_000) },
        { mint: TOKEN_MINT, amount: new BN(1_000_000) },
      ],
      "versioned-tx-test-batch-deposit"
    );
    console.log("Batch deposit (wSOL + token) signature:", signature);

    const afterWsolShares = await fetchShareBalance(NATIVE_MINT, provider.publicKey);
    const afterTokenShares = await fetchShareBalance(TOKEN_MINT, provider.publicKey);

    assert.isTrue(afterWsolShares.gt(beforeWsolShares), "wSOL deposit leg should have minted shares");
    assert.isTrue(afterTokenShares.gt(beforeTokenShares), "SPL token deposit leg should have minted shares");
  });

  it("Rejects a batch deposit when the wallet can't cover one of the legs", async () => {
    // Fresh wallet, no TOKEN_MINT balance
    const poorSigner = Keypair.generate();
    await provider.sendAndConfirm(
      new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: provider.publicKey,
          toPubkey: poorSigner.publicKey,
          lamports: anchor.web3.LAMPORTS_PER_SOL / 20,
        })
      )
    );

    try {
      await batchDepositTokens(
        program,
        stakingProgram.programId,
        provider.connection,
        poorSigner,
        [{ mint: TOKEN_MINT, amount: new BN(1_000_000) }],
        "versioned-tx-test-insufficient-balance"
      );
      assert.fail("Batch deposit should have failed for a signer with no token balance");
    } catch (err) {
      // The SPL transfer inside deposit() fails here, not a check of our own
      assert.include(err.toString().toLowerCase(), "insufficient");
    }
  });

  it("Same deposit succeeds through both a legacy transaction and a v0 transaction", async () => {
    await wrapSol(provider.wallet.payer, 2_000_000);

    const userWsolAta = getAssociatedTokenAddressSync(NATIVE_MINT, provider.publicKey);
    const bankWsolAta = getAssociatedTokenAddressSync(NATIVE_MINT, BANK_APP_ACCOUNTS.bankVault, true);
    const userShareAta = getAssociatedTokenAddressSync(BANK_APP_ACCOUNTS.shareMint(NATIVE_MINT), provider.publicKey);
    const [stakingInfo] = PublicKey.findProgramAddressSync(
      [Buffer.from("USER_INFO"), BANK_APP_ACCOUNTS.bankVault.toBuffer()],
      stakingProgram.programId
    );

    const beforeShares = await fetchShareBalance(NATIVE_MINT, provider.publicKey);

    const legacyIx = await program.methods
      .deposit(new BN(500_000))
      // Custom token_program constraint breaks accounts() auto-resolve here
      .accountsPartial({
        tokenMint: NATIVE_MINT,
        stakingInfo,
        user: provider.publicKey,
        userAta: userWsolAta,
        bankAta: bankWsolAta,
        userShareAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
    const legacyTx = new Transaction().add(
      createAssociatedTokenAccountIdempotentInstruction(provider.publicKey, bankWsolAta, BANK_APP_ACCOUNTS.bankVault, NATIVE_MINT),
      legacyIx
    );
    const legacySig = await provider.sendAndConfirm(legacyTx);
    console.log("Legacy deposit signature:", legacySig);

    const afterLegacyShares = await fetchShareBalance(NATIVE_MINT, provider.publicKey);
    assert.isTrue(afterLegacyShares.gt(beforeShares));

    // Same instruction, sent as v0 this time (no ALT needed for a single small deposit)
    const v0Ix: TransactionInstruction = await program.methods
      .deposit(new BN(500_000))
      // Custom token_program constraint breaks accounts() auto-resolve here
      .accountsPartial({
        tokenMint: NATIVE_MINT,
        stakingInfo,
        user: provider.publicKey,
        userAta: userWsolAta,
        bankAta: bankWsolAta,
        userShareAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
    const { blockhash, lastValidBlockHeight } = await provider.connection.getLatestBlockhash();
    const messageV0 = new TransactionMessage({
      payerKey: provider.publicKey,
      recentBlockhash: blockhash,
      instructions: [v0Ix],
    }).compileToV0Message();
    const v0Tx = new VersionedTransaction(messageV0);
    v0Tx.sign([provider.wallet.payer]);
    const v0Sig = await provider.connection.sendTransaction(v0Tx);
    await provider.connection.confirmTransaction({ signature: v0Sig, blockhash, lastValidBlockHeight }, "confirmed");
    console.log("v0 deposit signature:", v0Sig);

    const afterV0Shares = await fetchShareBalance(NATIVE_MINT, provider.publicKey);
    assert.isTrue(afterV0Shares.gt(afterLegacyShares));
  });

  it("Batch-sends SOL to multiple recipients in one versioned transaction", async () => {
    const recipients = [Keypair.generate(), Keypair.generate(), Keypair.generate()];
    const lamportsEach = 1_000_000;

    const before = await Promise.all(
      recipients.map((r) => provider.connection.getBalance(r.publicKey))
    );

    const signature = await batchSendSol(
      provider.connection,
      provider.wallet.payer,
      recipients.map((r) => ({ to: r.publicKey, lamports: lamportsEach })),
      "versioned-tx-test-batch-sol"
    );
    console.log("Batch SOL send signature:", signature);

    const after = await Promise.all(
      recipients.map((r) => provider.connection.getBalance(r.publicKey))
    );
    after.forEach((balance, i) => {
      assert.equal(balance, before[i] + lamportsEach);
    });
  });
});
