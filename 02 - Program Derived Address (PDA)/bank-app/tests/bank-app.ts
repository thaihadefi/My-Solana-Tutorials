import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { BankApp } from "../target/types/bank_app";
import { Keypair, PublicKey } from "@solana/web3.js";
import { BN } from "bn.js";
import { assert } from "chai";

describe("bank-app", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider);

  const program = anchor.workspace.BankApp as Program<BankApp>;

  const BANK_APP_ACCOUNTS = {
    bankInfo: PublicKey.findProgramAddressSync(
      [Buffer.from("BANK_INFO_SEED")],
      program.programId
    )[0],
    bankVault: PublicKey.findProgramAddressSync(
      [Buffer.from("BANK_VAULT_SEED")],
      program.programId
    )[0],
    userReserve: (pubkey: PublicKey) => PublicKey.findProgramAddressSync(
      [
        Buffer.from("USER_RESERVE_SEED"),
        pubkey.toBuffer()
      ],
      program.programId
    )[0],
  }

  it("Is initialized!", async () => {
    try {
      const bankInfo = await program.account.bankInfo.fetch(BANK_APP_ACCOUNTS.bankInfo)
      console.log("Bank info: ", bankInfo)
    } catch {
      const tx = await program.methods.initialize()
        .accounts({
          authority: provider.publicKey,
        }).rpc();
      console.log("Initialize signature: ", tx);
    }

    // Reset in case a prior run left the bank paused
    const bankInfo = await program.account.bankInfo.fetch(BANK_APP_ACCOUNTS.bankInfo);
    if (bankInfo.isPaused) {
      await program.methods.unpause()
        .accounts({
          authority: provider.publicKey,
        }).rpc();
    }
  });

  it("Is deposited!", async () => {
    const before = await program.account.userReserve.fetchNullable(BANK_APP_ACCOUNTS.userReserve(provider.publicKey));
    const beforeAmount = before ? before.depositedAmount : new BN(0);

    const depositAmount = new BN(1_000_000);
    const tx = await program.methods.deposit(depositAmount)
      .accounts({
        user: provider.publicKey,
      }).rpc();
    console.log("Deposit signature: ", tx);

    const after = await program.account.userReserve.fetch(BANK_APP_ACCOUNTS.userReserve(provider.publicKey));
    assert.equal(
      after.depositedAmount.toString(),
      beforeAmount.add(depositAmount).toString()
    );
  });

  it("Is withdrawn!", async () => {
    const before = await program.account.userReserve.fetch(BANK_APP_ACCOUNTS.userReserve(provider.publicKey));

    const withdrawAmount = new BN(400_000);
    const tx = await program.methods.withdraw(withdrawAmount)
      .accounts({
        user: provider.publicKey,
      }).rpc();
    console.log("Withdraw signature: ", tx);

    const after = await program.account.userReserve.fetch(BANK_APP_ACCOUNTS.userReserve(provider.publicKey));
    assert.equal(
      after.depositedAmount.toString(),
      before.depositedAmount.sub(withdrawAmount).toString()
    );
  });

  it("Rejects withdrawing more than the deposited amount", async () => {
    const userReserve = await program.account.userReserve.fetch(BANK_APP_ACCOUNTS.userReserve(provider.publicKey));
    const tooMuch = userReserve.depositedAmount.add(new BN(1_000_000));

    try {
      await program.methods.withdraw(tooMuch)
        .accounts({
          user: provider.publicKey,
        }).rpc();
      assert.fail("Withdraw should have been blocked for insufficient funds");
    } catch (err) {
      assert.include(err.toString(), "InsufficientFunds");
    }
  });

  it("Rejects pause from a non-authority signer", async () => {
    const rogue = Keypair.generate();

    try {
      await program.methods.pause()
        .accounts({
          authority: rogue.publicKey,
        })
        .signers([rogue])
        .rpc();
      assert.fail("Non-authority should not be able to pause the bank");
    } catch (err) {
      assert.include(err.toString(), "ConstraintAddress");
    }
  });

  it("Can pause and unpause the bank", async () => {
    await program.methods.pause()
      .accounts({
        authority: provider.publicKey,
      }).rpc();

    let bankInfo = await program.account.bankInfo.fetch(BANK_APP_ACCOUNTS.bankInfo);
    assert.isTrue(bankInfo.isPaused);

    // Double-pause should reject, not no-op
    try {
      await program.methods.pause()
        .accounts({
          authority: provider.publicKey,
        }).rpc();
      assert.fail("Pausing an already-paused bank should fail");
    } catch (err) {
      assert.include(err.toString(), "BankAppPaused");
    }

    try {
      await program.methods.deposit(new BN(1_000_000))
        .accounts({
          user: provider.publicKey,
        }).rpc();
      assert.fail("Deposit should have been blocked while paused");
    } catch (err) {
      assert.include(err.toString(), "BankAppPaused");
    }

    try {
      await program.methods.withdraw(new BN(100_000))
        .accounts({
          user: provider.publicKey,
        }).rpc();
      assert.fail("Withdraw should have been blocked while paused");
    } catch (err) {
      assert.include(err.toString(), "BankAppPaused");
    }

    await program.methods.unpause()
      .accounts({
        authority: provider.publicKey,
      }).rpc();

    bankInfo = await program.account.bankInfo.fetch(BANK_APP_ACCOUNTS.bankInfo);
    assert.isFalse(bankInfo.isPaused);

    // And the reverse
    try {
      await program.methods.unpause()
        .accounts({
          authority: provider.publicKey,
        }).rpc();
      assert.fail("Unpausing an already-unpaused bank should fail");
    } catch (err) {
      assert.include(err.toString(), "BankAppNotPaused");
    }

    const tx = await program.methods.deposit(new BN(100_000))
      .accounts({
        user: provider.publicKey,
      }).rpc();
    console.log("Deposit after unpause signature: ", tx);
  });
});
