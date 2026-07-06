import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { BankApp } from "../target/types/bank_app";
import { PublicKey } from "@solana/web3.js";
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
      //const userReserve = await program.account.userReserve.fetch(BANK_APP_ACCOUNTS.userReserve(provider.publicKey))
      console.log("Bank info: ", bankInfo)
    } catch {
      const tx = await program.methods.initialize()
        .accounts({
          authority: provider.publicKey,
        }).rpc();
      console.log("Initialize signature: ", tx);
    }
  });

  it("Is deposited!", async () => {
    const tx = await program.methods.deposit(new BN(1_000_000))
      .accounts({
        user: provider.publicKey,
      }).rpc();
    console.log("Deposit signature: ", tx);

    const userReserve = await program.account.userReserve.fetch(BANK_APP_ACCOUNTS.userReserve(provider.publicKey))
    console.log("User reserve: ", userReserve.depositedAmount.toString())
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

  it("Can pause and unpause the bank", async () => {
    await program.methods.pause(true)
      .accounts({
        authority: provider.publicKey,
      }).rpc();

    let bankInfo = await program.account.bankInfo.fetch(BANK_APP_ACCOUNTS.bankInfo);
    assert.isTrue(bankInfo.isPaused);

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

    await program.methods.pause(false)
      .accounts({
        authority: provider.publicKey,
      }).rpc();

    bankInfo = await program.account.bankInfo.fetch(BANK_APP_ACCOUNTS.bankInfo);
    assert.isFalse(bankInfo.isPaused);

    const tx = await program.methods.deposit(new BN(100_000))
      .accounts({
        user: provider.publicKey,
      }).rpc();
    console.log("Deposit after unpause signature: ", tx);
  });
});
