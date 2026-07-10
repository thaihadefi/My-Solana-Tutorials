import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { BankApp } from "../target/types/bank_app";
import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { BN } from "bn.js";
import { createAssociatedTokenAccountInstruction, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { assert } from "chai";

describe("bank-app", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider);

  const program = anchor.workspace.BankApp as Program<BankApp>;

  // token mint created via `spl-token create-token` on devnet, see README section 2
  const TOKEN_MINT = new PublicKey("7eeyDsUYHQd4RftTPfw9Zu37eDcicbdtcZ3oHRgaw4MM");

  const BANK_APP_ACCOUNTS = {
    bankInfo: PublicKey.findProgramAddressSync(
      [Buffer.from("BANK_INFO_SEED")],
      program.programId
    )[0],
    bankVault: PublicKey.findProgramAddressSync(
      [Buffer.from("BANK_VAULT_SEED")],
      program.programId
    )[0],
    userReserve: (pubkey: PublicKey, tokenMint?: PublicKey) => {
      let SEEDS = [
        Buffer.from("USER_RESERVE_SEED"),
        pubkey.toBuffer(),
      ]

      if (tokenMint != undefined) {
        SEEDS.push(tokenMint.toBuffer())
      }

      return PublicKey.findProgramAddressSync(
        SEEDS,
        program.programId
      )[0]
    }
  }

  const ensureAtaExists = async (mint: PublicKey, owner: PublicKey, allowOwnerOffCurve: boolean) => {
    const ata = getAssociatedTokenAddressSync(mint, owner, allowOwnerOffCurve);
    const preInstructions: TransactionInstruction[] = [];
    if (await provider.connection.getAccountInfo(ata) == null) {
      preInstructions.push(createAssociatedTokenAccountInstruction(
        provider.publicKey,
        ata,
        owner,
        mint
      ));
    }
    return { ata, preInstructions };
  };

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

  it("Is deposited token!", async () => {
    const { preInstructions: userAtaIx } = await ensureAtaExists(TOKEN_MINT, provider.publicKey, false);
    const { preInstructions: bankAtaIx } = await ensureAtaExists(TOKEN_MINT, BANK_APP_ACCOUNTS.bankVault, true);

    const depositAmount = new BN(500_000);
    const tx = await program.methods.depositToken(depositAmount)
      .accounts({
        tokenMint: TOKEN_MINT,
        user: provider.publicKey,
      })
      .preInstructions([...userAtaIx, ...bankAtaIx])
      .rpc();
    console.log("Deposit token signature: ", tx);

    const userReserve = await program.account.userReserve.fetch(BANK_APP_ACCOUNTS.userReserve(provider.publicKey, TOKEN_MINT))
    console.log("User token reserve: ", userReserve.depositedAmount.toString())
  });

  it("Is withdrawn token!", async () => {
    const before = await program.account.userReserve.fetch(BANK_APP_ACCOUNTS.userReserve(provider.publicKey, TOKEN_MINT));

    const withdrawAmount = new BN(200_000);
    const tx = await program.methods.withdrawToken(withdrawAmount)
      .accounts({
        tokenMint: TOKEN_MINT,
        user: provider.publicKey,
      }).rpc();
    console.log("Withdraw token signature: ", tx);

    const after = await program.account.userReserve.fetch(BANK_APP_ACCOUNTS.userReserve(provider.publicKey, TOKEN_MINT));
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

    await program.methods.pause(false)
      .accounts({
        authority: provider.publicKey,
      }).rpc();

    bankInfo = await program.account.bankInfo.fetch(BANK_APP_ACCOUNTS.bankInfo);
    assert.isFalse(bankInfo.isPaused);
  });
});
