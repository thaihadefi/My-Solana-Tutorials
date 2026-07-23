import * as anchor from "@coral-xyz/anchor";
import { BN } from "bn.js";
import { expect } from "chai";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  Transaction,
} from "@solana/web3.js";

describe("exercise", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Exercise;

  // ---------------- Part 1: Instruction Ordering ----------------

  it("fails to execute without approval", async () => {
    try {
      await program.methods
        .execute(new BN(1000))
        .accounts({
          authority: provider.wallet.publicKey,
          instructions: SYSVAR_INSTRUCTIONS_PUBKEY,
        })
        .rpc();

      expect.fail("Should have failed");
    } catch (err: any) {
      expect(err.message).to.include("MustApproveFirst");
    }
  });

  it("succeeds with approval in same transaction", async () => {
    const approveIx = await program.methods
      .approve()
      .accounts({ authority: provider.wallet.publicKey })
      .instruction();

    const executeIx = await program.methods
      .execute(new BN(1000))
      .accounts({
        authority: provider.wallet.publicKey,
        instructions: SYSVAR_INSTRUCTIONS_PUBKEY,
      })
      .instruction();

    const tx = new Transaction().add(approveIx).add(executeIx);
    await provider.sendAndConfirm(tx);
  });

  it("fails with wrong order (execute before approve)", async () => {
    const approveIx = await program.methods
      .approve()
      .accounts({ authority: provider.wallet.publicKey })
      .instruction();

    const executeIx = await program.methods
      .execute(new BN(1000))
      .accounts({
        authority: provider.wallet.publicKey,
        instructions: SYSVAR_INSTRUCTIONS_PUBKEY,
      })
      .instruction();

    const tx = new Transaction().add(executeIx).add(approveIx);

    try {
      await provider.sendAndConfirm(tx);
      expect.fail("Should have failed");
    } catch (err: any) {
      expect(err.message).to.include("MustApproveFirst");
    }
  });

  // ---------------- Part 2: Regular Account<T> vs Zero-Copy ----------------

  it("initializes and uses large approval data with regular Account<T>", async () => {
    const [regularPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("APPROVAL_REGULAR"), provider.wallet.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .initializeLargeApprovalRegular()
      .accounts({
        approvalData: regularPda,
        authority: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    await program.methods
      .processLargeApprovalRegular()
      .accounts({
        approvalData: regularPda,
        authority: provider.wallet.publicKey,
      })
      .rpc();

    const accountInfo = await provider.connection.getAccountInfo(regularPda);
    expect(accountInfo).to.not.be.null;
    expect(accountInfo!.data.length).to.be.greaterThan(8);
  });

  it("initializes and uses large approval data with zero-copy AccountLoader<T>", async () => {
    const [zcPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("APPROVAL_ZERO_COPY"), provider.wallet.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .initializeLargeApprovalZeroCopy()
      .accounts({
        approvalData: zcPda,
        authority: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    await program.methods
      .processLargeApprovalZeroCopy()
      .accounts({
        approvalData: zcPda,
        authority: provider.wallet.publicKey,
      })
      .rpc();

    const accountInfo = await provider.connection.getAccountInfo(zcPda);
    expect(accountInfo).to.not.be.null;
    expect(accountInfo!.data.length).to.be.greaterThan(4096);
  });

  // ---------------- Part 3: Remaining Accounts ----------------

  describe("multi_send", () => {
    const amountPerRecipient = new BN(1_000_000);

    it("rejects zero recipients", async () => {
      try {
        await program.methods
          .multiSend(amountPerRecipient)
          .accounts({
            sender: provider.wallet.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .remainingAccounts([])
          .rpc();
        expect.fail("Should have failed");
      } catch (err: any) {
        expect(err.message).to.include("NoRecipients");
      }
    });

    it("rejects more than 10 recipients", async () => {
      const recipients = Array.from({ length: 11 }, () => ({
        pubkey: Keypair.generate().publicKey,
        isWritable: true,
        isSigner: false,
      }));

      try {
        await program.methods
          .multiSend(amountPerRecipient)
          .accounts({
            sender: provider.wallet.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .remainingAccounts(recipients)
          .rpc();
        expect.fail("Should have failed");
      } catch (err: any) {
        expect(err.message).to.include("TooManyRecipients");
      }
    });

    it("rejects a non-writable recipient", async () => {
      const recipients = [
        {
          pubkey: Keypair.generate().publicKey,
          isWritable: false,
          isSigner: false,
        },
      ];

      try {
        await program.methods
          .multiSend(amountPerRecipient)
          .accounts({
            sender: provider.wallet.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .remainingAccounts(recipients)
          .rpc();
        expect.fail("Should have failed");
      } catch (err: any) {
        expect(err.message).to.include("RecipientNotWritable");
      }
    });

    it("sends SOL to 3 recipients in one instruction", async () => {
      const recipientKeys = [Keypair.generate(), Keypair.generate(), Keypair.generate()];
      const before = await Promise.all(
        recipientKeys.map((kp) => provider.connection.getBalance(kp.publicKey))
      );

      const recipients = recipientKeys.map((kp) => ({
        pubkey: kp.publicKey,
        isWritable: true,
        isSigner: false,
      }));

      await program.methods
        .multiSend(amountPerRecipient)
        .accounts({
          sender: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .remainingAccounts(recipients)
        .rpc();

      const after = await Promise.all(
        recipientKeys.map((kp) => provider.connection.getBalance(kp.publicKey))
      );
      after.forEach((balance, i) => {
        expect(balance).to.equal(before[i] + amountPerRecipient.toNumber());
      });
    });
  });
});
