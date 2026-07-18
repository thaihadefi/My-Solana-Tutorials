import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { StakingApp } from "../target/types/staking_app";
import { PublicKey } from "@solana/web3.js";
import { BN } from "bn.js";
import { assert } from "chai";

describe("staking-app", () => {
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider);

  const program = anchor.workspace.StakingApp as Program<StakingApp>;

  const userInfo = PublicKey.findProgramAddressSync(
    [Buffer.from("USER_INFO"), provider.publicKey.toBuffer()],
    program.programId
  )[0];

  // Only the rejection path — happy path is already covered in token-staking-app.ts
  it("Rejects unstaking more SOL than staked", async () => {
    await program.methods.stake(new BN(1_000_000), true)
      .accounts({ user: provider.publicKey, payer: provider.publicKey })
      .rpc();

    const current = (await program.account.userInfo.fetch(userInfo)).amount;
    const tooMuch = current.add(new BN(1_000_000));

    try {
      await program.methods.stake(tooMuch, false)
        .accounts({ user: provider.publicKey, payer: provider.publicKey })
        .rpc();
      assert.fail("Unstake should have been blocked for insufficient staked amount");
    } catch (err) {
      assert.include(err.toString(), "InsufficientStakedAmount");
    }
  });
});
