import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { BankApp } from "../target/types/bank_app";
import { StakingApp } from "../target/types/staking_app";
import { TokenStakingApp } from "../target/types/token_staking_app";
import { Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import { BN } from "bn.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createCloseAccountInstruction,
  createSyncNativeInstruction,
  getAssociatedTokenAddressSync,
  NATIVE_MINT,
} from "@solana/spl-token";
import { assert } from "chai";

describe("bank-app", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider);

  const program = anchor.workspace.BankApp as Program<BankApp>;
  const stakingProgram = anchor.workspace.StakingApp as Program<StakingApp>;
  const tokenStakingProgram = anchor.workspace.TokenStakingApp as Program<TokenStakingApp>;

  // Token mint created via `spl-token create-token` on devnet
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

  const STAKING_APP_ACCOUNTS = {
    stakingVault: PublicKey.findProgramAddressSync(
      [Buffer.from("STAKING_VAULT")],
      stakingProgram.programId
    )[0],
    userInfo: (pubkey: PublicKey) => PublicKey.findProgramAddressSync(
      [Buffer.from("USER_INFO"), pubkey.toBuffer()],
      stakingProgram.programId
    )[0],
  }

  const TOKEN_STAKING_APP_ACCOUNTS = {
    stakingVault: PublicKey.findProgramAddressSync(
      [Buffer.from("TOKEN_STAKING_VAULT")],
      tokenStakingProgram.programId
    )[0],
    userInfo: (pubkey: PublicKey, mint: PublicKey) => PublicKey.findProgramAddressSync(
      [Buffer.from("TOKEN_USER_INFO"), pubkey.toBuffer(), mint.toBuffer()],
      tokenStakingProgram.programId
    )[0],
  }

  const ensureAtaExists = (mint: PublicKey, owner: PublicKey, allowOwnerOffCurve: boolean) => {
    const ata = getAssociatedTokenAddressSync(mint, owner, allowOwnerOffCurve);
    const preInstructions: TransactionInstruction[] = [
      createAssociatedTokenAccountIdempotentInstruction(
        provider.publicKey,
        ata,
        owner,
        mint
      ),
    ];
    return preInstructions;
  };

  const wrapSol = (amount: InstanceType<typeof BN>) => {
    const userWsolAta = getAssociatedTokenAddressSync(NATIVE_MINT, provider.publicKey);
    const preInstructions: TransactionInstruction[] = [
      createAssociatedTokenAccountIdempotentInstruction(
        provider.publicKey,
        userWsolAta,
        provider.publicKey,
        NATIVE_MINT
      ),
    ];
    preInstructions.push(SystemProgram.transfer({
      fromPubkey: provider.publicKey,
      toPubkey: userWsolAta,
      lamports: amount.toNumber(),
    }));
    preInstructions.push(createSyncNativeInstruction(userWsolAta));

    return preInstructions;
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

    // Reset in case a prior run left the bank paused
    const bankInfo = await program.account.bankInfo.fetch(BANK_APP_ACCOUNTS.bankInfo);
    if (bankInfo.isPaused) {
      await program.methods.unpause()
        .accounts({
          authority: provider.publicKey,
        }).rpc();
    }
  });

  it("Is deposited! (SOL wrapped as wSOL)", async () => {
    const before = await program.account.userReserve.fetchNullable(BANK_APP_ACCOUNTS.userReserve(provider.publicKey, NATIVE_MINT));
    const beforeAmount = before ? before.depositedAmount : new BN(0);

    const bankAtaIx = ensureAtaExists(NATIVE_MINT, BANK_APP_ACCOUNTS.bankVault, true);
    const depositAmount = new BN(10_000_000);
    const wrapInstructions = wrapSol(depositAmount);

    const tx = await program.methods.deposit(depositAmount)
      .accounts({
        tokenMint: NATIVE_MINT,
        user: provider.publicKey,
      })
      .preInstructions([...wrapInstructions, ...bankAtaIx])
      .rpc();
    console.log("Deposit (wSOL) signature: ", tx);

    const after = await program.account.userReserve.fetch(BANK_APP_ACCOUNTS.userReserve(provider.publicKey, NATIVE_MINT));
    assert.equal(
      after.depositedAmount.toString(),
      beforeAmount.add(depositAmount).toString()
    );
  });

  it("Is withdrawn! (wSOL)", async () => {
    const before = await program.account.userReserve.fetch(BANK_APP_ACCOUNTS.userReserve(provider.publicKey, NATIVE_MINT));

    const withdrawAmount = new BN(1_000_000);
    const tx = await program.methods.withdraw(withdrawAmount)
      .accounts({
        tokenMint: NATIVE_MINT,
        user: provider.publicKey,
      }).rpc();
    console.log("Withdraw (wSOL) signature: ", tx);

    const after = await program.account.userReserve.fetch(BANK_APP_ACCOUNTS.userReserve(provider.publicKey, NATIVE_MINT));
    assert.equal(
      after.depositedAmount.toString(),
      before.depositedAmount.sub(withdrawAmount).toString()
    );
  });

  it("Rejects withdrawing more wSOL than deposited", async () => {
    const userReserve = await program.account.userReserve.fetch(BANK_APP_ACCOUNTS.userReserve(provider.publicKey, NATIVE_MINT));
    const tooMuch = userReserve.depositedAmount.add(new BN(1_000_000));

    try {
      await program.methods.withdraw(tooMuch)
        .accounts({
          tokenMint: NATIVE_MINT,
          user: provider.publicKey,
        }).rpc();
      assert.fail("Withdraw should have been blocked for insufficient funds");
    } catch (err) {
      assert.include(err.toString(), "InsufficientFunds");
    }
  });

  it("Unwraps remaining wSOL back to native SOL", async () => {
    // Closing the ATA returns its lamports (balance + rent) as native SOL
    const userWsolAta = getAssociatedTokenAddressSync(NATIVE_MINT, provider.publicKey);
    const unwrapTx = await provider.sendAndConfirm(
      new Transaction().add(
        createCloseAccountInstruction(userWsolAta, provider.publicKey, provider.publicKey)
      )
    );
    console.log("Unwrap (close wSOL ATA) signature: ", unwrapTx);

    const ataInfo = await provider.connection.getAccountInfo(userWsolAta);
    assert.isNull(ataInfo);
  });

  it("Is deposited token!", async () => {
    const before = await program.account.userReserve.fetchNullable(BANK_APP_ACCOUNTS.userReserve(provider.publicKey, TOKEN_MINT));
    const beforeAmount = before ? before.depositedAmount : new BN(0);

    const userAtaIx = ensureAtaExists(TOKEN_MINT, provider.publicKey, false);
    const bankAtaIx = ensureAtaExists(TOKEN_MINT, BANK_APP_ACCOUNTS.bankVault, true);

    const depositAmount = new BN(5_000_000);
    const tx = await program.methods.deposit(depositAmount)
      .accounts({
        tokenMint: TOKEN_MINT,
        user: provider.publicKey,
      })
      .preInstructions([...userAtaIx, ...bankAtaIx])
      .rpc();
    console.log("Deposit token signature: ", tx);

    const after = await program.account.userReserve.fetch(BANK_APP_ACCOUNTS.userReserve(provider.publicKey, TOKEN_MINT));
    assert.equal(
      after.depositedAmount.toString(),
      beforeAmount.add(depositAmount).toString()
    );
  });

  it("Is withdrawn token!", async () => {
    const before = await program.account.userReserve.fetch(BANK_APP_ACCOUNTS.userReserve(provider.publicKey, TOKEN_MINT));

    const withdrawAmount = new BN(1_000_000);
    const tx = await program.methods.withdraw(withdrawAmount)
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

  it("Rejects withdrawing more token than deposited", async () => {
    const userReserve = await program.account.userReserve.fetch(BANK_APP_ACCOUNTS.userReserve(provider.publicKey, TOKEN_MINT));
    const tooMuch = userReserve.depositedAmount.add(new BN(1_000_000));

    try {
      await program.methods.withdraw(tooMuch)
        .accounts({
          tokenMint: TOKEN_MINT,
          user: provider.publicKey,
        }).rpc();
      assert.fail("Withdraw should have been blocked for insufficient funds");
    } catch (err) {
      assert.include(err.toString(), "InsufficientFunds");
    }
  });

  it("Bank invests (stakes) SOL into the Staking App via CPI", async () => {
    const stakingInfo = STAKING_APP_ACCOUNTS.userInfo(BANK_APP_ACCOUNTS.bankVault);
    const bankWsolAta = getAssociatedTokenAddressSync(NATIVE_MINT, BANK_APP_ACCOUNTS.bankVault, true);

    let before = new BN(0);
    try {
      before = (await stakingProgram.account.userInfo.fetch(stakingInfo)).amount;
    } catch { /* not staked yet */ }
    const poolBefore = (await program.provider.connection.getTokenAccountBalance(bankWsolAta)).value.amount;

    const stakeAmount = new BN(2_000_000);
    const tx = await program.methods.invest(stakeAmount, true)
      .accounts({
        stakingVault: STAKING_APP_ACCOUNTS.stakingVault,
        stakingInfo,
        authority: provider.publicKey,
      }).rpc();
    console.log("Invest (stake) signature: ", tx);

    const after = (await stakingProgram.account.userInfo.fetch(stakingInfo)).amount;
    assert.isTrue(after.gte(before.add(stakeAmount)));

    const poolAfter = (await program.provider.connection.getTokenAccountBalance(bankWsolAta)).value.amount;
    assert.equal(new BN(poolBefore).sub(stakeAmount).toString(), poolAfter);
  });

  it("Bank withdraws (unstakes) SOL from the Staking App via CPI", async () => {
    const stakingInfo = STAKING_APP_ACCOUNTS.userInfo(BANK_APP_ACCOUNTS.bankVault);
    const bankWsolAta = getAssociatedTokenAddressSync(NATIVE_MINT, BANK_APP_ACCOUNTS.bankVault, true);
    const before = (await stakingProgram.account.userInfo.fetch(stakingInfo)).amount;
    const poolBefore = (await program.provider.connection.getTokenAccountBalance(bankWsolAta)).value.amount;

    const unstakeAmount = new BN(1_000_000);
    const tx = await program.methods.invest(unstakeAmount, false)
      .accounts({
        stakingVault: STAKING_APP_ACCOUNTS.stakingVault,
        stakingInfo,
        authority: provider.publicKey,
      }).rpc();
    console.log("Invest (unstake) signature: ", tx);

    const after = (await stakingProgram.account.userInfo.fetch(stakingInfo)).amount;
    assert.isTrue(after.lte(before.sub(unstakeAmount)));

    const poolAfter = (await program.provider.connection.getTokenAccountBalance(bankWsolAta)).value.amount;
    assert.equal(new BN(poolBefore).add(unstakeAmount).toString(), poolAfter);
  });

  it("User can still withdraw wSOL after the bank invests part of the pool", async () => {
    const before = await program.account.userReserve.fetch(BANK_APP_ACCOUNTS.userReserve(provider.publicKey, NATIVE_MINT));

    const withdrawAmount = new BN(500_000);
    const tx = await program.methods.withdraw(withdrawAmount)
      .accounts({
        tokenMint: NATIVE_MINT,
        user: provider.publicKey,
      })
      .preInstructions(ensureAtaExists(NATIVE_MINT, provider.publicKey, false))
      .rpc();
    console.log("Withdraw (wSOL) after invest signature: ", tx);

    const after = await program.account.userReserve.fetch(BANK_APP_ACCOUNTS.userReserve(provider.publicKey, NATIVE_MINT));
    assert.equal(
      after.depositedAmount.toString(),
      before.depositedAmount.sub(withdrawAmount).toString()
    );
  });

  it("Rewraps correctly when a stake drains the pool to exactly zero", async () => {
    const stakingInfo = STAKING_APP_ACCOUNTS.userInfo(BANK_APP_ACCOUNTS.bankVault);
    const bankWsolAta = getAssociatedTokenAddressSync(NATIVE_MINT, BANK_APP_ACCOUNTS.bankVault, true);

    const poolBefore = new BN((await program.provider.connection.getTokenAccountBalance(bankWsolAta)).value.amount);

    const tx = await program.methods.invest(poolBefore, true)
      .accounts({
        stakingVault: STAKING_APP_ACCOUNTS.stakingVault,
        stakingInfo,
        authority: provider.publicKey,
      }).rpc();
    console.log("Invest (full drain stake) signature: ", tx);

    const ataInfo = await provider.connection.getAccountInfo(bankWsolAta);
    assert.isNotNull(ataInfo, "bank_wsol_ata must still exist after draining it to zero");

    const poolAfter = (await program.provider.connection.getTokenAccountBalance(bankWsolAta)).value.amount;
    assert.equal(poolAfter, "0");

    // Restore liquidity for the rest of the suite.
    await program.methods.invest(poolBefore, false)
      .accounts({
        stakingVault: STAKING_APP_ACCOUNTS.stakingVault,
        stakingInfo,
        authority: provider.publicKey,
      }).rpc();
  });

  it("Bank invests (stakes) SPL token into the Token Staking App via CPI", async () => {
    const stakingVaultAta = getAssociatedTokenAddressSync(TOKEN_MINT, TOKEN_STAKING_APP_ACCOUNTS.stakingVault, true);
    const stakingInfo = TOKEN_STAKING_APP_ACCOUNTS.userInfo(BANK_APP_ACCOUNTS.bankVault, TOKEN_MINT);

    let before = new BN(0);
    try {
      before = (await tokenStakingProgram.account.userInfo.fetch(stakingInfo)).amount;
    } catch { /* not staked yet */ }

    const stakeAmount = new BN(1_000_000);
    const tx = await program.methods.investToken(stakeAmount, true)
      .accounts({
        tokenMint: TOKEN_MINT,
        stakingVault: TOKEN_STAKING_APP_ACCOUNTS.stakingVault,
        stakingVaultAta,
        stakingInfo,
        authority: provider.publicKey,
      }).rpc();
    console.log("Invest token (stake) signature: ", tx);

    const after = (await tokenStakingProgram.account.userInfo.fetch(stakingInfo)).amount;
    assert.isTrue(after.gte(before.add(stakeAmount)));
  });

  it("Bank withdraws (unstakes) SPL token from the Token Staking App via CPI", async () => {
    const stakingVaultAta = getAssociatedTokenAddressSync(TOKEN_MINT, TOKEN_STAKING_APP_ACCOUNTS.stakingVault, true);
    const stakingInfo = TOKEN_STAKING_APP_ACCOUNTS.userInfo(BANK_APP_ACCOUNTS.bankVault, TOKEN_MINT);
    const before = (await tokenStakingProgram.account.userInfo.fetch(stakingInfo)).amount;

    const unstakeAmount = new BN(500_000);
    const tx = await program.methods.investToken(unstakeAmount, false)
      .accounts({
        tokenMint: TOKEN_MINT,
        stakingVault: TOKEN_STAKING_APP_ACCOUNTS.stakingVault,
        stakingVaultAta,
        stakingInfo,
        authority: provider.publicKey,
      }).rpc();
    console.log("Invest token (unstake) signature: ", tx);

    const after = (await tokenStakingProgram.account.userInfo.fetch(stakingInfo)).amount;
    assert.isTrue(after.lte(before.sub(unstakeAmount)));
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

  it("Rejects invest from a non-authority signer", async () => {
    const rogue = Keypair.generate();

    try {
      await program.methods.invest(new BN(1), true)
        .accounts({
          stakingVault: STAKING_APP_ACCOUNTS.stakingVault,
          stakingInfo: STAKING_APP_ACCOUNTS.userInfo(BANK_APP_ACCOUNTS.bankVault),
          authority: rogue.publicKey,
        })
        .signers([rogue])
        .rpc();
      assert.fail("Non-authority should not be able to invest bank funds");
    } catch (err) {
      assert.include(err.toString(), "ConstraintAddress");
    }
  });

  it("Rejects investToken from a non-authority signer", async () => {
    const rogue = Keypair.generate();
    const stakingVaultAta = getAssociatedTokenAddressSync(TOKEN_MINT, TOKEN_STAKING_APP_ACCOUNTS.stakingVault, true);

    try {
      await program.methods.investToken(new BN(1), true)
        .accounts({
          tokenMint: TOKEN_MINT,
          stakingVault: TOKEN_STAKING_APP_ACCOUNTS.stakingVault,
          stakingVaultAta,
          stakingInfo: TOKEN_STAKING_APP_ACCOUNTS.userInfo(BANK_APP_ACCOUNTS.bankVault, TOKEN_MINT),
          authority: rogue.publicKey,
        })
        .signers([rogue])
        .rpc();
      assert.fail("Non-authority should not be able to invest bank token funds");
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
          tokenMint: TOKEN_MINT,
          user: provider.publicKey,
        }).rpc();
      assert.fail("Deposit should have been blocked while paused");
    } catch (err) {
      assert.include(err.toString(), "BankAppPaused");
    }

    try {
      await program.methods.invest(new BN(1_000_000), true)
        .accounts({
          stakingVault: STAKING_APP_ACCOUNTS.stakingVault,
          stakingInfo: STAKING_APP_ACCOUNTS.userInfo(BANK_APP_ACCOUNTS.bankVault),
          authority: provider.publicKey,
        }).rpc();
      assert.fail("Invest should have been blocked while paused");
    } catch (err) {
      assert.include(err.toString(), "BankAppPaused");
    }

    try {
      const stakingVaultAta = getAssociatedTokenAddressSync(TOKEN_MINT, TOKEN_STAKING_APP_ACCOUNTS.stakingVault, true);
      await program.methods.investToken(new BN(1_000_000), true)
        .accounts({
          tokenMint: TOKEN_MINT,
          stakingVault: TOKEN_STAKING_APP_ACCOUNTS.stakingVault,
          stakingVaultAta,
          stakingInfo: TOKEN_STAKING_APP_ACCOUNTS.userInfo(BANK_APP_ACCOUNTS.bankVault, TOKEN_MINT),
          authority: provider.publicKey,
        }).rpc();
      assert.fail("InvestToken should have been blocked while paused");
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
  });
});
