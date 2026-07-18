import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { BankApp } from "../target/types/bank_app";
import { StakingApp } from "../target/types/staking_app";
import { Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import { BN } from "bn.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createCloseAccountInstruction,
  createSyncNativeInstruction,
  createTransferInstruction,
  getAssociatedTokenAddressSync,
  NATIVE_MINT,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { assert } from "chai";

describe("bank-app", () => {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider);

  const program = anchor.workspace.BankApp as Program<BankApp>;
  const stakingProgram = anchor.workspace.StakingApp as Program<StakingApp>;

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
    // Vault's share token for `mint` — supply doubles as total_shares issued
    shareMint: (tokenMint: PublicKey) => PublicKey.findProgramAddressSync(
      [Buffer.from("SHARE_MINT_SEED"), tokenMint.toBuffer()],
      program.programId
    )[0],
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

  // Bank_vault's staking position for `mint` — staking-app for wSOL, dummy otherwise
  const stakingInfoFor = (mint: PublicKey) => mint.equals(NATIVE_MINT)
    ? STAKING_APP_ACCOUNTS.userInfo(BANK_APP_ACCOUNTS.bankVault)
    : BANK_APP_ACCOUNTS.bankVault;

  // The added associated_token::token_program constraint breaks client auto-resolution here
  const depositWithdrawAccounts = (mint: PublicKey, user: PublicKey) => ({
    userAta: getAssociatedTokenAddressSync(mint, user),
    bankAta: getAssociatedTokenAddressSync(mint, BANK_APP_ACCOUNTS.bankVault, true),
    userShareAta: getAssociatedTokenAddressSync(BANK_APP_ACCOUNTS.shareMint(mint), user),
    tokenProgram: TOKEN_PROGRAM_ID,
  });

  const fetchInvestedAmount = async (mint: PublicKey): Promise<InstanceType<typeof BN>> => {
    try {
      if (mint.equals(NATIVE_MINT)) {
        return (await stakingProgram.account.userInfo.fetch(STAKING_APP_ACCOUNTS.userInfo(BANK_APP_ACCOUNTS.bankVault))).amount;
      }
      return new BN(0);
    } catch {
      return new BN(0); // staking position never opened yet
    }
  };

  const fetchTotalAssets = async (mint: PublicKey): Promise<InstanceType<typeof BN>> => {
    const bankAta = getAssociatedTokenAddressSync(mint, BANK_APP_ACCOUNTS.bankVault, true);
    let liquid = new BN(0);
    try {
      liquid = new BN((await provider.connection.getTokenAccountBalance(bankAta)).value.amount);
    } catch { /* bank_ata not created yet */ }
    return liquid.add(await fetchInvestedAmount(mint));
  };

  // Total_shares == the share mint's supply, since shares are real SPL tokens now
  const fetchTotalShares = async (mint: PublicKey): Promise<InstanceType<typeof BN>> => {
    try {
      const supply = await provider.connection.getTokenSupply(BANK_APP_ACCOUNTS.shareMint(mint));
      return new BN(supply.value.amount);
    } catch {
      return new BN(0); // share mint not created yet
    }
  };

  // A user's shares == their balance of the vault's share token
  const fetchShareBalance = async (mint: PublicKey, owner: PublicKey): Promise<InstanceType<typeof BN>> => {
    const ata = getAssociatedTokenAddressSync(BANK_APP_ACCOUNTS.shareMint(mint), owner);
    try {
      return new BN((await provider.connection.getTokenAccountBalance(ata)).value.amount);
    } catch {
      return new BN(0); // share ATA not created yet
    }
  };

  // Mirrors exchange_rate::shares_for_deposit
  const sharesForDeposit = (assets: InstanceType<typeof BN>, totalAssets: InstanceType<typeof BN>, totalShares: InstanceType<typeof BN>) =>
    (totalShares.isZero() || totalAssets.isZero()) ? assets : assets.mul(totalShares).div(totalAssets);

  // Mirrors exchange_rate::shares_for_withdraw
  const sharesForWithdraw = (assets: InstanceType<typeof BN>, totalAssets: InstanceType<typeof BN>, totalShares: InstanceType<typeof BN>) =>
    assets.mul(totalShares).add(totalAssets.subn(1)).div(totalAssets);

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

  // Funds a test signer from the provider wallet (devnet faucet rate-limits per IP)
  const fundTestSigner = async (to: PublicKey, lamports: number) => {
    const tx = await provider.sendAndConfirm(
      new Transaction().add(
        SystemProgram.transfer({ fromPubkey: provider.publicKey, toPubkey: to, lamports })
      )
    );
    return tx;
  };

  // Owner signs and pays rent + amount
  const wrapSol = (owner: PublicKey, amount: InstanceType<typeof BN>) => {
    const ownerWsolAta = getAssociatedTokenAddressSync(NATIVE_MINT, owner);
    const preInstructions: TransactionInstruction[] = [
      createAssociatedTokenAccountIdempotentInstruction(
        owner,
        ownerWsolAta,
        owner,
        NATIVE_MINT
      ),
    ];
    preInstructions.push(SystemProgram.transfer({
      fromPubkey: owner,
      toPubkey: ownerWsolAta,
      lamports: amount.toNumber(),
    }));
    preInstructions.push(createSyncNativeInstruction(ownerWsolAta));

    return preInstructions;
  };

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  it("Initializes the bank", async () => {
    try {
      const bankInfo = await program.account.bankInfo.fetch(BANK_APP_ACCOUNTS.bankInfo)
      console.log("Bank info: ", bankInfo)
    } catch {
      const tx = await program.methods.initialize()
        .accountsPartial({
          authority: provider.publicKey,
        }).rpc();
      console.log("Initialize signature: ", tx);
    }

    // Reset in case a prior run left the bank paused
    const bankInfo = await program.account.bankInfo.fetch(BANK_APP_ACCOUNTS.bankInfo);
    if (bankInfo.isPaused) {
      await program.methods.unpause()
        .accountsPartial({
          authority: provider.publicKey,
        }).rpc();
    }
  });

  it("Deposits wrapped SOL (wSOL)", async () => {
    const beforeShares = await fetchShareBalance(NATIVE_MINT, provider.publicKey);
    const totalAssetsBefore = await fetchTotalAssets(NATIVE_MINT);
    const totalSharesBefore = await fetchTotalShares(NATIVE_MINT);

    const bankAtaIx = ensureAtaExists(NATIVE_MINT, BANK_APP_ACCOUNTS.bankVault, true);
    const depositAmount = new BN(10_000_000);
    const wrapInstructions = wrapSol(provider.publicKey, depositAmount);
    const expectedShares = sharesForDeposit(depositAmount, totalAssetsBefore, totalSharesBefore);

    const tx = await program.methods.deposit(depositAmount)
      .accountsPartial({
        tokenMint: NATIVE_MINT,
        stakingInfo: stakingInfoFor(NATIVE_MINT),
        user: provider.publicKey,
        ...depositWithdrawAccounts(NATIVE_MINT, provider.publicKey),
      })
      .preInstructions([...wrapInstructions, ...bankAtaIx])
      .rpc();
    console.log("Deposit (wSOL) signature: ", tx);

    const afterShares = await fetchShareBalance(NATIVE_MINT, provider.publicKey);
    assert.equal(afterShares.toString(), beforeShares.add(expectedShares).toString());
  });

  it("Withdraws wSOL", async () => {
    const beforeShares = await fetchShareBalance(NATIVE_MINT, provider.publicKey);
    const totalAssetsBefore = await fetchTotalAssets(NATIVE_MINT);
    const totalSharesBefore = await fetchTotalShares(NATIVE_MINT);

    const withdrawAmount = new BN(1_000_000);
    const expectedSharesBurned = sharesForWithdraw(withdrawAmount, totalAssetsBefore, totalSharesBefore);

    const tx = await program.methods.withdraw(withdrawAmount)
      .accountsPartial({
        tokenMint: NATIVE_MINT,
        stakingInfo: stakingInfoFor(NATIVE_MINT),
        user: provider.publicKey,
        ...depositWithdrawAccounts(NATIVE_MINT, provider.publicKey),
      }).rpc();
    console.log("Withdraw (wSOL) signature: ", tx);

    const afterShares = await fetchShareBalance(NATIVE_MINT, provider.publicKey);
    assert.equal(afterShares.toString(), beforeShares.sub(expectedSharesBurned).toString());
  });

  it("Rejects withdrawing more wSOL than deposited", async () => {
    const shares = await fetchShareBalance(NATIVE_MINT, provider.publicKey);
    const totalAssets = await fetchTotalAssets(NATIVE_MINT);
    const totalShares = await fetchTotalShares(NATIVE_MINT);
    // Push past whatever the user's shares are worth in the underlying asset
    const tooMuch = sharesForWithdraw(shares, totalShares, totalAssets).add(new BN(1_000_000));

    try {
      await program.methods.withdraw(tooMuch)
        .accountsPartial({
          tokenMint: NATIVE_MINT,
          stakingInfo: stakingInfoFor(NATIVE_MINT),
          user: provider.publicKey,
          ...depositWithdrawAccounts(NATIVE_MINT, provider.publicKey),
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

  it("Deposits an SPL token", async () => {
    const beforeShares = await fetchShareBalance(TOKEN_MINT, provider.publicKey);
    const totalAssetsBefore = await fetchTotalAssets(TOKEN_MINT);
    const totalSharesBefore = await fetchTotalShares(TOKEN_MINT);

    const userAtaIx = ensureAtaExists(TOKEN_MINT, provider.publicKey, false);
    const bankAtaIx = ensureAtaExists(TOKEN_MINT, BANK_APP_ACCOUNTS.bankVault, true);

    const depositAmount = new BN(5_000_000);
    const expectedShares = sharesForDeposit(depositAmount, totalAssetsBefore, totalSharesBefore);

    const tx = await program.methods.deposit(depositAmount)
      .accountsPartial({
        tokenMint: TOKEN_MINT,
        stakingInfo: stakingInfoFor(TOKEN_MINT),
        user: provider.publicKey,
        ...depositWithdrawAccounts(TOKEN_MINT, provider.publicKey),
      })
      .preInstructions([...userAtaIx, ...bankAtaIx])
      .rpc();
    console.log("Deposit token signature: ", tx);

    const afterShares = await fetchShareBalance(TOKEN_MINT, provider.publicKey);
    assert.equal(afterShares.toString(), beforeShares.add(expectedShares).toString());
  });

  it("Withdraws an SPL token", async () => {
    const beforeShares = await fetchShareBalance(TOKEN_MINT, provider.publicKey);
    const totalAssetsBefore = await fetchTotalAssets(TOKEN_MINT);
    const totalSharesBefore = await fetchTotalShares(TOKEN_MINT);

    const withdrawAmount = new BN(1_000_000);
    const expectedSharesBurned = sharesForWithdraw(withdrawAmount, totalAssetsBefore, totalSharesBefore);

    const tx = await program.methods.withdraw(withdrawAmount)
      .accountsPartial({
        tokenMint: TOKEN_MINT,
        stakingInfo: stakingInfoFor(TOKEN_MINT),
        user: provider.publicKey,
        ...depositWithdrawAccounts(TOKEN_MINT, provider.publicKey),
      }).rpc();
    console.log("Withdraw token signature: ", tx);

    const afterShares = await fetchShareBalance(TOKEN_MINT, provider.publicKey);
    assert.equal(afterShares.toString(), beforeShares.sub(expectedSharesBurned).toString());
  });

  it("Rejects withdrawing more token than deposited", async () => {
    const shares = await fetchShareBalance(TOKEN_MINT, provider.publicKey);
    const totalAssets = await fetchTotalAssets(TOKEN_MINT);
    const totalShares = await fetchTotalShares(TOKEN_MINT);
    const tooMuch = sharesForWithdraw(shares, totalShares, totalAssets).add(new BN(1_000_000));

    try {
      await program.methods.withdraw(tooMuch)
        .accountsPartial({
          tokenMint: TOKEN_MINT,
          stakingInfo: stakingInfoFor(TOKEN_MINT),
          user: provider.publicKey,
          ...depositWithdrawAccounts(TOKEN_MINT, provider.publicKey),
        }).rpc();
      assert.fail("Withdraw should have been blocked for insufficient funds");
    } catch (err) {
      assert.include(err.toString(), "InsufficientFunds");
    }
  });

  it("Rejects a zero-amount deposit", async () => {
    try {
      await program.methods.deposit(new BN(0))
        .accountsPartial({
          tokenMint: TOKEN_MINT,
          stakingInfo: stakingInfoFor(TOKEN_MINT),
          user: provider.publicKey,
          ...depositWithdrawAccounts(TOKEN_MINT, provider.publicKey),
        }).rpc();
      assert.fail("Zero-amount deposit should be rejected");
    } catch (err) {
      assert.include(err.toString(), "ZeroShares");
    }
  });

  it("Rejects a zero-amount withdraw", async () => {
    try {
      await program.methods.withdraw(new BN(0))
        .accountsPartial({
          tokenMint: TOKEN_MINT,
          stakingInfo: stakingInfoFor(TOKEN_MINT),
          user: provider.publicKey,
          ...depositWithdrawAccounts(TOKEN_MINT, provider.publicKey),
        }).rpc();
      assert.fail("Zero-amount withdraw should be rejected");
    } catch (err) {
      assert.include(err.toString(), "ZeroShares");
    }
  });

  it("Rejects a mismatched staking-info account", async () => {
    try {
      // Depositing TOKEN_MINT but pointing staking_info at wSOL's position
      await program.methods.deposit(new BN(1))
        .accountsPartial({
          tokenMint: TOKEN_MINT,
          stakingInfo: stakingInfoFor(NATIVE_MINT),
          user: provider.publicKey,
          ...depositWithdrawAccounts(TOKEN_MINT, provider.publicKey),
        }).rpc();
      assert.fail("Mismatched staking-info account should be rejected");
    } catch (err) {
      assert.include(err.toString(), "InvalidStakingInfoAccount");
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
      .accountsPartial({
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
    console.log("Sleeping 10s to let interest accrue...");
    await sleep(10000);
    const stakingInfo = STAKING_APP_ACCOUNTS.userInfo(BANK_APP_ACCOUNTS.bankVault);
    const bankWsolAta = getAssociatedTokenAddressSync(NATIVE_MINT, BANK_APP_ACCOUNTS.bankVault, true);
    const before = (await stakingProgram.account.userInfo.fetch(stakingInfo)).amount;
    const poolBefore = (await program.provider.connection.getTokenAccountBalance(bankWsolAta)).value.amount;

    const unstakeAmount = new BN(1_000_000);
    const tx = await program.methods.invest(unstakeAmount, false)
      .accountsPartial({
        stakingVault: STAKING_APP_ACCOUNTS.stakingVault,
        stakingInfo,
        authority: provider.publicKey,
      }).rpc();
    console.log("Invest (unstake) signature: ", tx);

    const after = (await stakingProgram.account.userInfo.fetch(stakingInfo)).amount;
    assert.isTrue(after.gte(before.sub(unstakeAmount)));

    const poolAfter = (await program.provider.connection.getTokenAccountBalance(bankWsolAta)).value.amount;
    assert.equal(new BN(poolBefore).add(unstakeAmount).toString(), poolAfter);
  });

  it("User can still withdraw wSOL after the bank invests part of the pool", async () => {
    const beforeShares = await fetchShareBalance(NATIVE_MINT, provider.publicKey);
    const totalAssetsBefore = await fetchTotalAssets(NATIVE_MINT);
    const totalSharesBefore = await fetchTotalShares(NATIVE_MINT);

    const withdrawAmount = new BN(500_000);
    const expectedSharesBurned = sharesForWithdraw(withdrawAmount, totalAssetsBefore, totalSharesBefore);

    const tx = await program.methods.withdraw(withdrawAmount)
      .accountsPartial({
        tokenMint: NATIVE_MINT,
        stakingInfo: stakingInfoFor(NATIVE_MINT),
        user: provider.publicKey,
        ...depositWithdrawAccounts(NATIVE_MINT, provider.publicKey),
      })
      .preInstructions(ensureAtaExists(NATIVE_MINT, provider.publicKey, false))
      .rpc();
    console.log("Withdraw (wSOL) after invest signature: ", tx);

    const afterShares = await fetchShareBalance(NATIVE_MINT, provider.publicKey);
    assert.equal(afterShares.toString(), beforeShares.sub(expectedSharesBurned).toString());
    // Interest only accrues, so 1 share is always worth >= 1 asset unit
    assert.isTrue(expectedSharesBurned.lte(withdrawAmount));
  });

  it("Fully draining the pool blocks withdrawals until liquidity is restored", async () => {
    const stakingInfo = STAKING_APP_ACCOUNTS.userInfo(BANK_APP_ACCOUNTS.bankVault);
    const bankWsolAta = getAssociatedTokenAddressSync(NATIVE_MINT, BANK_APP_ACCOUNTS.bankVault, true);
    const poolBefore = new BN((await program.provider.connection.getTokenAccountBalance(bankWsolAta)).value.amount);

    const tx = await program.methods.invest(poolBefore, true)
      .accountsPartial({
        stakingVault: STAKING_APP_ACCOUNTS.stakingVault,
        stakingInfo,
        authority: provider.publicKey,
      }).rpc();
    console.log("Invest (full drain stake) signature: ", tx);

    const ataInfo = await provider.connection.getAccountInfo(bankWsolAta);
    assert.isNotNull(ataInfo, "bank_wsol_ata must still exist after draining it to zero");
    const poolAfter = (await program.provider.connection.getTokenAccountBalance(bankWsolAta)).value.amount;
    assert.equal(poolAfter, "0");

    try {
      // Vault is drained to zero, so this should fail on liquidity, not on shares
      await program.methods.withdraw(new BN(1))
        .accountsPartial({
          tokenMint: NATIVE_MINT,
          stakingInfo: stakingInfoFor(NATIVE_MINT),
          user: provider.publicKey,
          ...depositWithdrawAccounts(NATIVE_MINT, provider.publicKey),
        }).rpc();
      assert.fail("Withdraw should have been blocked for insufficient liquidity");
    } catch (err) {
      assert.include(err.toString(), "InsufficientLiquidity");
    } finally {
      // Restore liquidity for the rest of the suite
      await program.methods.invest(poolBefore, false)
        .accountsPartial({
          stakingVault: STAKING_APP_ACCOUNTS.stakingVault,
          stakingInfo,
          authority: provider.publicKey,
        }).rpc();
    }
  });

  it("Mints fewer shares per asset for a later depositor once interest has accrued", async () => {
    const totalAssetsBefore = await fetchTotalAssets(NATIVE_MINT);
    const totalSharesBefore = await fetchTotalShares(NATIVE_MINT);
    assert.isTrue(
      totalAssetsBefore.gt(totalSharesBefore),
      "expected interest accrued earlier in the suite to have grown total_assets past total_shares"
    );

    const userB = Keypair.generate();
    await fundTestSigner(userB.publicKey, anchor.web3.LAMPORTS_PER_SOL / 20);

    const depositAmount = new BN(1_000_000);
    const expectedShares = sharesForDeposit(depositAmount, totalAssetsBefore, totalSharesBefore);
    assert.isTrue(
      expectedShares.lt(depositAmount),
      "a later depositor should be minted fewer shares than raw assets once the exchange rate has grown above 1:1"
    );

    const bankAtaIx = ensureAtaExists(NATIVE_MINT, BANK_APP_ACCOUNTS.bankVault, true);
    const tx = await program.methods.deposit(depositAmount)
      .accountsPartial({
        tokenMint: NATIVE_MINT,
        stakingInfo: stakingInfoFor(NATIVE_MINT),
        user: userB.publicKey,
        ...depositWithdrawAccounts(NATIVE_MINT, userB.publicKey),
      })
      .preInstructions([...wrapSol(userB.publicKey, depositAmount), ...bankAtaIx])
      .signers([userB])
      .rpc();
    console.log("Second depositor (userB) deposit signature: ", tx);

    const userBShares = await fetchShareBalance(NATIVE_MINT, userB.publicKey);
    assert.equal(userBShares.toString(), expectedShares.toString());

    const totalSharesAfter = await fetchTotalShares(NATIVE_MINT);
    assert.equal(totalSharesAfter.toString(), totalSharesBefore.add(expectedShares).toString());
  });

  it("Later depositor (userB) can withdraw their own deposit back out", async () => {
    const userB = Keypair.generate();
    await fundTestSigner(userB.publicKey, anchor.web3.LAMPORTS_PER_SOL / 20);

    const depositAmount = new BN(1_000_000);
    const bankAtaIx = ensureAtaExists(NATIVE_MINT, BANK_APP_ACCOUNTS.bankVault, true);

    await program.methods.deposit(depositAmount)
      .accountsPartial({
        tokenMint: NATIVE_MINT,
        stakingInfo: stakingInfoFor(NATIVE_MINT),
        user: userB.publicKey,
        ...depositWithdrawAccounts(NATIVE_MINT, userB.publicKey),
      })
      .preInstructions([...wrapSol(userB.publicKey, depositAmount), ...bankAtaIx])
      .signers([userB])
      .rpc();

    const userBShares = await fetchShareBalance(NATIVE_MINT, userB.publicKey);

    // Mint floors / redeem ceils, so redeeming the exact deposit back can be 1-2 units short
    const totalAssetsBeforeWithdraw = await fetchTotalAssets(NATIVE_MINT);
    const totalSharesBeforeWithdraw = await fetchTotalShares(NATIVE_MINT);
    const maxRedeemable = userBShares.mul(totalAssetsBeforeWithdraw).div(totalSharesBeforeWithdraw);
    assert.isTrue(
      maxRedeemable.gt(depositAmount.subn(15)),
      "userB's deposit should be redeemable back to within rounding tolerance"
    );
    const expectedSharesBurned = sharesForWithdraw(maxRedeemable, totalAssetsBeforeWithdraw, totalSharesBeforeWithdraw);
    assert.isTrue(
      expectedSharesBurned.lte(userBShares),
      "userB should have enough shares to redeem their own just-made deposit back"
    );

    const tx = await program.methods.withdraw(maxRedeemable)
      .accountsPartial({
        tokenMint: NATIVE_MINT,
        stakingInfo: stakingInfoFor(NATIVE_MINT),
        user: userB.publicKey,
        ...depositWithdrawAccounts(NATIVE_MINT, userB.publicKey),
      })
      .preInstructions(ensureAtaExists(NATIVE_MINT, userB.publicKey, false))
      .signers([userB])
      .rpc();
    console.log("Second depositor (userB) withdraw signature: ", tx);

    const userBSharesAfter = await fetchShareBalance(NATIVE_MINT, userB.publicKey);
    assert.equal(userBSharesAfter.toString(), userBShares.sub(expectedSharesBurned).toString());
  });

  it("Rejects pause from a non-authority signer", async () => {
    const rogue = Keypair.generate();

    try {
      await program.methods.pause()
        .accountsPartial({
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
        .accountsPartial({
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

  it("Can pause and unpause the bank", async () => {
    await program.methods.pause()
      .accountsPartial({
        authority: provider.publicKey,
      }).rpc();

    let bankInfo = await program.account.bankInfo.fetch(BANK_APP_ACCOUNTS.bankInfo);
    assert.isTrue(bankInfo.isPaused);

    // Double-pause should reject, not no-op
    try {
      await program.methods.pause()
        .accountsPartial({
          authority: provider.publicKey,
        }).rpc();
      assert.fail("Pausing an already-paused bank should fail");
    } catch (err) {
      assert.include(err.toString(), "BankAppPaused");
    }

    try {
      await program.methods.deposit(new BN(1_000_000))
        .accountsPartial({
          tokenMint: TOKEN_MINT,
          stakingInfo: stakingInfoFor(TOKEN_MINT),
          user: provider.publicKey,
          ...depositWithdrawAccounts(TOKEN_MINT, provider.publicKey),
        }).rpc();
      assert.fail("Deposit should have been blocked while paused");
    } catch (err) {
      assert.include(err.toString(), "BankAppPaused");
    }

    try {
      await program.methods.invest(new BN(1_000_000), true)
        .accountsPartial({
          stakingVault: STAKING_APP_ACCOUNTS.stakingVault,
          stakingInfo: STAKING_APP_ACCOUNTS.userInfo(BANK_APP_ACCOUNTS.bankVault),
          authority: provider.publicKey,
        }).rpc();
      assert.fail("Invest should have been blocked while paused");
    } catch (err) {
      assert.include(err.toString(), "BankAppPaused");
    }

    await program.methods.unpause()
      .accountsPartial({
        authority: provider.publicKey,
      }).rpc();

    bankInfo = await program.account.bankInfo.fetch(BANK_APP_ACCOUNTS.bankInfo);
    assert.isFalse(bankInfo.isPaused);

    // And the reverse
    try {
      await program.methods.unpause()
        .accountsPartial({
          authority: provider.publicKey,
        }).rpc();
      assert.fail("Unpausing an already-unpaused bank should fail");
    } catch (err) {
      assert.include(err.toString(), "BankAppNotPaused");
    }
  });
});
