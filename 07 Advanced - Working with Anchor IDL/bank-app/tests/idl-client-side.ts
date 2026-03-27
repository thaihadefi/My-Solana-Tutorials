import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { expect } from "chai";
import * as fs from "fs";

describe("IDL Client-side", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);


  let stakingProgram: Program;

  it("Load Program from IDL file", () => {
    // Không được dùng anchor.workspace
    // Tạo Program: stakingProgram = new Program(idl, provider)
    // Log và kiểm tra programId
    console.log("Program ID:", stakingProgram.programId.toBase58());
    expect(stakingProgram.programId.toBase58()).to.equal(
      "EYdKY4wWuwNr7uVRQNBUEXeJyLCAatSELPck3quW7JvA"
    );
  });

  it("Derive staking_vault PDA from IDL seeds", () => {
    // Your code here
    // 1. Lấy instruction "stake" từ stakingProgram.idl.instructions
    // 2. Tìm account "staking_vault", đọc pda.seeds[0].value (byte array)
    // 3. Convert byte array thành Buffer: Buffer.from(seedBytes)
    // 4. Derive PDA bằng PublicKey.findProgramAddressSync
    // 5. So sánh với PDA derive thông thường: Buffer.from("STAKING_VAULT")

    const [vaultNormal] = PublicKey.findProgramAddressSync(
      [Buffer.from("STAKING_VAULT")],
      stakingProgram.programId
    );

    // const stakeIx = stakingProgram.idl.instructions.find(...)
    // const vaultAccount = stakeIx.accounts.find(...)
    // const seedBytes = vaultAccount.pda.seeds[0].value
    // const [vaultFromIdl] = PublicKey.findProgramAddressSync([Buffer.from(seedBytes)], ...)

    // expect(vaultFromIdl.toBase58()).to.equal(vaultNormal.toBase58());
  });

  it("Derive user_info PDA from IDL seeds", () => {
    // Your code here
    // user_info có 2 seeds:
    //   seed 1: kind = "const" -> byte array cố định (= "USER_INFO")
    //   seed 2: kind = "account", path = "user" -> public key của user
    //
    // 1. Lấy seed1 (const) từ IDL, convert thành Buffer
    // 2. Lấy seed2 = provider.publicKey.toBuffer()
    // 3. Derive PDA
    // 4. So sánh với PDA derive thông thường

    const [userInfoNormal] = PublicKey.findProgramAddressSync(
      [Buffer.from("USER_INFO"), provider.publicKey.toBuffer()],
      stakingProgram.programId
    );

    // expect(userInfoFromIdl.toBase58()).to.equal(userInfoNormal.toBase58());
  });

  it("Fetch and decode account data using IDL Program", async () => {
    // Your code here
    // Sau khi đã có stakingProgram từ IDL, bạn có thể fetch account data:
    // const userInfoPda = <derive PDA từ bài trên>
    // const userInfo = await stakingProgram.account.userInfo.fetch(userInfoPda)
    // console.log("Amount:", userInfo.amount.toString())
    // console.log("Last update time:", userInfo.lastUpdateTime.toString())
  });
});
