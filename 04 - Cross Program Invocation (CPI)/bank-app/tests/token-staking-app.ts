import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TokenStakingApp } from "../target/types/token_staking_app";
import { PublicKey } from "@solana/web3.js";
import { BN } from "bn.js";
import { assert } from "chai";

describe("token-staking-app", () => {
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider);

  const program = anchor.workspace.TokenStakingApp as Program<TokenStakingApp>;

  // Token mint created via `spl-token create-token` on devnet 
  const TOKEN_MINT = new PublicKey("7eeyDsUYHQd4RftTPfw9Zu37eDcicbdtcZ3oHRgaw4MM");

  const userInfo = PublicKey.findProgramAddressSync(
    [Buffer.from("TOKEN_USER_INFO"), provider.publicKey.toBuffer(), TOKEN_MINT.toBuffer()],
    program.programId
  )[0];

  it("Stakes SPL tokens", async () => {
    let before = new BN(0);
    try {
      before = (await program.account.userInfo.fetch(userInfo)).amount;
    } catch { /* first stake */ }

    const stakeAmount = new BN(1_000_000);
    const tx = await program.methods.stake(stakeAmount, true)
      .accounts({
        tokenMint: TOKEN_MINT,
        user: provider.publicKey,
        payer: provider.publicKey,
      }).rpc();
    console.log("Stake signature: ", tx);

    const after = (await program.account.userInfo.fetch(userInfo)).amount;
    assert.isTrue(after.gte(before.add(stakeAmount)));
  });

  it("Unstakes SPL tokens", async () => {
    const before = (await program.account.userInfo.fetch(userInfo)).amount;

    const unstakeAmount = new BN(400_000);
    const tx = await program.methods.stake(unstakeAmount, false)
      .accounts({
        tokenMint: TOKEN_MINT,
        user: provider.publicKey,
        payer: provider.publicKey,
      }).rpc();
    console.log("Unstake signature: ", tx);

    const after = (await program.account.userInfo.fetch(userInfo)).amount;
    assert.isTrue(after.lte(before.sub(unstakeAmount)));
  });

  it("Rejects unstaking more than staked", async () => {
    const current = (await program.account.userInfo.fetch(userInfo)).amount;
    const tooMuch = current.add(new BN(1_000_000));

    try {
      await program.methods.stake(tooMuch, false)
        .accounts({
          tokenMint: TOKEN_MINT,
          user: provider.publicKey,
          payer: provider.publicKey,
        }).rpc();
      assert.fail("Unstake should have been blocked for insufficient staked amount");
    } catch (err) {
      assert.include(err.toString(), "InsufficientStakedAmount");
    }
  });
});
