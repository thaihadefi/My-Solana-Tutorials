import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { BankApp } from "../target/types/bank_app";
import { PublicKey, SystemProgram, TransactionInstruction } from "@solana/web3.js";
import { BN } from "bn.js";
import { createAssociatedTokenAccountInstruction, getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { StakingApp } from "../target/types/staking_app";
import { assert } from "chai";

describe("bank-app", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider);

  const program = anchor.workspace.BankApp as Program<BankApp>;
  const stakingProgram = anchor.workspace.StakingApp as Program<StakingApp>;

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

  it("Is initialized!", async () => {
    try {
      const bankInfo = await program.account.bankInfo.fetch(BANK_APP_ACCOUNTS.bankInfo)
      console.log("Bank info: ", bankInfo)
    } catch {
      const tx = await program.methods.initialize()
        .accountsPartial({
          bankInfo: BANK_APP_ACCOUNTS.bankInfo,
          bankVault: BANK_APP_ACCOUNTS.bankVault,
          authority: provider.publicKey,
          systemProgram: SystemProgram.programId
        }).rpc();
      console.log("Initialize signature: ", tx);
    }
  });

  it("Is deposited!", async () => {
    const tx = await program.methods.deposit(new BN(1_000_000))
      .accountsPartial({
        bankInfo: BANK_APP_ACCOUNTS.bankInfo,
        bankVault: BANK_APP_ACCOUNTS.bankVault,
        userReserve: BANK_APP_ACCOUNTS.userReserve(provider.publicKey),
        user: provider.publicKey,
        systemProgram: SystemProgram.programId
      }).rpc();
    console.log("Deposit signature: ", tx);

    const userReserve = await program.account.userReserve.fetch(BANK_APP_ACCOUNTS.userReserve(provider.publicKey))
    console.log("User reserve: ", userReserve.depositedAmount.toString())
  });

  it("Is deposited token!", async () => {
    let tokenMint = new PublicKey("") // Điền token mint của bạn vào
    let userAta = getAssociatedTokenAddressSync(tokenMint, provider.publicKey)
    let bankAta = getAssociatedTokenAddressSync(tokenMint, BANK_APP_ACCOUNTS.bankVault, true)

    let preInstructions: TransactionInstruction[] = []
    if (await provider.connection.getAccountInfo(bankAta) == null) {
      preInstructions.push(createAssociatedTokenAccountInstruction(
        provider.publicKey,
        bankAta,
        BANK_APP_ACCOUNTS.bankVault,
        tokenMint
      ))
    }

    const tx = await program.methods.depositToken(new BN(1_000_000_000))
      .accountsPartial({
        bankInfo: BANK_APP_ACCOUNTS.bankInfo,
        bankVault: BANK_APP_ACCOUNTS.bankVault,
        tokenMint,
        userAta,
        bankAta,
        userReserve: BANK_APP_ACCOUNTS.userReserve(provider.publicKey, tokenMint),
        user: provider.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId
      }).preInstructions(preInstructions).rpc();
    console.log("Deposit token signature: ", tx);

    const userReserve = await program.account.userReserve.fetch(BANK_APP_ACCOUNTS.userReserve(provider.publicKey, tokenMint))
    console.log("User reserve: ", userReserve.depositedAmount.toString())
  });

  // staking-app's real devnet id from idl.json, not ours to deploy
  describe("invest / invest_raw against the real staking-app", () => {
    const STAKING_PROGRAM_ID = new PublicKey("EYdKY4wWuwNr7uVRQNBUEXeJyLCAatSELPck3quW7JvA");
    const stakingVault = PublicKey.findProgramAddressSync(
      [Buffer.from("STAKING_VAULT")],
      STAKING_PROGRAM_ID
    )[0];
    const stakingUserInfo = (user: PublicKey) => PublicKey.findProgramAddressSync(
      [Buffer.from("USER_INFO"), user.toBuffer()],
      STAKING_PROGRAM_ID
    )[0];

    const fetchStakedAmount = async (pda: PublicKey) => {
      const info = await provider.connection.getAccountInfo(pda);
      if (!info) return new BN(0);
      return new BN(info.data.readBigUInt64LE(8).toString());
    };

    const userInfoPda = stakingUserInfo(BANK_APP_ACCOUNTS.bankVault);

    it("Funds the bank vault", async () => {
      await program.methods.deposit(new BN(50_000_000))
        .accountsPartial({
          bankInfo: BANK_APP_ACCOUNTS.bankInfo,
          bankVault: BANK_APP_ACCOUNTS.bankVault,
          userReserve: BANK_APP_ACCOUNTS.userReserve(provider.publicKey),
          user: provider.publicKey,
          systemProgram: SystemProgram.programId
        }).rpc();
    });

    it("Stakes via the anchor-gen CPI crate (invest)", async () => {
      const vaultBefore = await provider.connection.getBalance(BANK_APP_ACCOUNTS.bankVault);

      const tx = await program.methods.invest(new BN(10_000_000), true)
        .accountsPartial({
          bankInfo: BANK_APP_ACCOUNTS.bankInfo,
          bankVault: BANK_APP_ACCOUNTS.bankVault,
          stakingVault,
          stakingInfo: userInfoPda,
          stakingProgram: STAKING_PROGRAM_ID,
          authority: provider.publicKey,
          systemProgram: SystemProgram.programId
        }).rpc();
      console.log("Invest (CPI) signature: ", tx);

      const vaultAfter = await provider.connection.getBalance(BANK_APP_ACCOUNTS.bankVault);
      const staked = await fetchStakedAmount(userInfoPda);

      assert.equal(vaultBefore - vaultAfter, 10_000_000);
      assert.ok(staked.gte(new BN(10_000_000)));
    });

    it("Unstakes via the raw invoke_signed instruction (invest_raw), matching the CPI result", async () => {
      const vaultBefore = await provider.connection.getBalance(BANK_APP_ACCOUNTS.bankVault);
      const stakedBefore = await fetchStakedAmount(userInfoPda);

      const tx = await program.methods.investRaw(new BN(10_000_000), false)
        .accountsPartial({
          bankInfo: BANK_APP_ACCOUNTS.bankInfo,
          bankVault: BANK_APP_ACCOUNTS.bankVault,
          stakingVault,
          stakingInfo: userInfoPda,
          stakingProgram: STAKING_PROGRAM_ID,
          authority: provider.publicKey,
          systemProgram: SystemProgram.programId
        }).rpc();
      console.log("Invest raw (unstake) signature: ", tx);

      const vaultAfter = await provider.connection.getBalance(BANK_APP_ACCOUNTS.bankVault);
      const stakedAfter = await fetchStakedAmount(userInfoPda);

      // invest_raw should unwind exactly what invest staked
      assert.equal(vaultAfter - vaultBefore, 10_000_000);
      assert.equal(stakedBefore.sub(stakedAfter).toNumber(), 10_000_000);
    });
  });
});
