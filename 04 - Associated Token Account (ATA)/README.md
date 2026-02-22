# Phần IV - Tài khoản Token Liên kết (ATA)
Bây giờ bạn đã học cách sử dụng các PDA để quản lý các tài khoản tùy chỉnh, đã đến lúc làm chủ một thành phần cơ bản khác trong phát triển Solana — Tài khoản Token Liên kết (Associated Token Accounts - ATAs). Đây là các tài khoản đặc biệt được sử dụng để lưu trữ các token SPL.

Cho dù bạn đang xây dựng một giao thức cho vay, hay một DAO, bạn sẽ cần hiểu cách thức hoạt động của ATA để xử lý các vấn đề liên quan đến việc chuyển token một cách an toàn và hiệu quả.

Trong phần này, bạn sẽ:  
✅ Hiểu ATA là gì và tầm quan trọng của nó
✅ Đúc (Mint) token SPL đầu tiên ?  
✅ Học cách lấy và tạo ATA bằng client Anchor TS  
✅ Tích hợp ATA vào Bank app để cho phép gửi và rút token  

Đến cuối phần này, bạn sẽ có thể tạo, quản lý và tương tác với các tài khoản token SPL như một chuyên gia — đặt nền tảng cho bất kỳ điều gì liên quan đến việc chuyển token, phần thưởng hoặc thanh toán.  
Bắt đầu thôi! 💰🚀

### Nhớ lại ví dụ trước: Bank app 🏦
Trong phiên này, chúng ta sẽ mở rộng Bank app để hỗ trợ các token SPL. Cụ thể, chúng ta sẽ thêm hai lệnh mới:
+ `DepositToken` — cho phép người dùng gửi bất kỳ token SPL nào vào ngân hàng
+ `WithdrawToken` — cho phép người dùng rút chính token mà họ đã gửi trước đó

Bản nâng cấp này biến Bank app của bạn từ chỉ dùng SOL thành một kho lưu trữ với token khác nhau — một bước tiến tới gần hơn với DeFi trong thực tế. Hãy cùng xây dựng! 🧱💸

### 1. ATA là gì?
ATA thực chất là một PDA (Program Derived Address) — nó không được tạo ngẫu nhiên. Nó được lấy ra một cách xác định bằng cách sử dụng các seeds :
```ts
[
  wallet_address,                 // Địa chỉ ví của chủ sở hữu token
  token_program_id,              // ID của chương trình SPL token
  mint_address                   // Địa chỉ đúc (mint) của SPL token
]
```
Các seeds này được truyền vào hàm `find_program_address` của ATA, với ID chương trình token liên kết là ID chương trình. Vì vậy trong mã nguồn, nó đại loại như sau:
```ts
Pubkey.findProgramAddressSync(
  [
    wallet_address.toBuffer(),                       
    TOKEN_PROGRAM_ID.toBuffer(),             
    mint_address.toBuffer(),                         
  ],
  ASSOCIATED_TOKEN_PROGRAM_ID
)
```
Điều này có nghĩa là địa chỉ ATA có thể được tính toán off-chain, mà không cần truy vấn trên blockchain.

✅ Giống như các PDA khác, ATA không có private key và chỉ có thể được tạo hoặc ký bởi ATAs. Đó là điều làm cho các ATA có tính dự đoán và an toàn.

#### 🤔 Tại sao chúng ta cần ATA?
Trong Solana, người dùng không giữ token trực tiếp trong địa chỉ ví của họ. Thay vào đó, mỗi token SPL (như USDC, wSOL, v.v.) được lưu trữ trong một Tài khoản Token (Token Account) — một tài khoản đặc biệt theo dõi số dư của một loại token cụ thể.

Tuy nhiên, một ví có thể tạo nhiều tài khoản token cho cùng một loại token được đúc (token mint). Điều này dẫn đến trải nghiệm người dùng (UX) lộn xộn và gây nhầm lẫn cho cả người dùng và nhà phát triển.

💡 Đó là lúc Tài khoản Token Liên kết (ATAs) xuất hiện.

Một Tài khoản Token Liên kết (ATA) là một tài khoản token tiêu chuẩn được lấy ra cho một ví và một token cụ thể được đúc. Nó đảm bảo:
+ 1 ví 👤
+ 1 loại token đúc 💰
+ 1 tài khoản token chính thức 📦

Không trùng lặp. Không nhầm lẫn. Nó trở thành tài khoản token chuẩn cho cặp (ví, token mint) đó.

### 2. Đúc token SPL đầu tiên của bạn
Bây giờ bạn đã hiểu ATA là gì, bạn có thể tự hỏi: "Chờ đã... trước khi tôi có một ATA, tôi không cần một token trước sao?" 😄  
Chính xác!

Thật may mắn, việc tạo một token SPL tùy chỉnh trên Solana cực kỳ dễ dàng — CLI `spl-token` xử lý hầu hết các công việc nặng nhọc cho bạn.

#### 🪙 Bước 1: Tạo một Token mới
Chạy lệnh sau để tạo token SPL của riêng bạn:
```bash
spl-token create-token
```

Bạn sẽ thấy kết quả như:
```bash
Creating token FBUoe8bLbPBh4VcF4jwg1L53XZBdSJoERry16u26UnNL under program TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA

Address:  FBUoe8bLbPBh4VcF4jwg1L53XZBdSJoERry16u26UnNL
Decimals:  9

Signature: 2rdLqDZxCEkknspKLcPs1qmhg3CcPcsmAdeoKNRekEfqpLDGiHzSZwUQMNjxH3zYneDCLWbNDGGD2EqG6uqvcjpk
```

🎉 Chúc mừng! Bạn đã tạo thành công token SPL đầu tiên của mình — khá dễ dàng, phải không?! 😄

Muốn xem nó còn có thể làm gì khác không? Hãy thử:
```bash
spl-token create-token --help
```

#### 🧾 Bước 2: Tạo ATA của bạn

Trước khi có thể nhận token, bạn cần một nơi để lưu trữ chúng. Đó là lúc Tài khoản Token Liên kết (ATA) phát huy tác dụng.

Tạo nó bằng cách chạy:
```bash
spl-token create-account <TOKEN_MINT_ADDRESS>
```
Ví dụ kết quả:
```bash
Creating account 5jLc6jKV2ggRDRQXveSnYBZZ4PWqzadFVfsyuBEYgSAh

Signature: 4APfm58fXbbiPDUzFdsXoXXe8ojsPqRiYddbQBdX17mFHyCExUofQEW6i6NX7SMUfvVra59SjP5MxW6kCsnToFPa
```
Chỉ cần vậy thôi, bạn đã sẵn sàng để nhận các token mới được đúc!

#### 💰 Bước 3: Đúc một số Token!

Bây giờ bạn có thể đúc token vào ATA của mình:
```bash
spl-token mint <TOKEN_MINT_ADDRESS> <TOKEN_AMOUNT> <RECIPIENT_TOKEN_ACCOUNT_ADDRESS>
```
Ví dụ:
```bash
spl-token mint FBUoe8bLbPBh4VcF4jwg1L53XZBdSJoERry16u26UnNL 1000000 5jLc6jKV2ggRDRQXveSnYBZZ4PWqzadFVfsyuBEYgSAh
```
Kết quả:
```bash
Minting 1000000 tokens
  Token: FBUoe8bLbPBh4VcF4jwg1L53XZBdSJoERry16u26UnNL
  Recipient: 5jLc6jKV2ggRDRQXveSnYBZZ4PWqzadFVfsyuBEYgSAh

Signature: 5WQEjynd3vD7zuwWSrLcksttdvnFWTJtPHpNK3WpJMNZ29ucW3uhiJTNX7QNdiF2EDpQfEyfGHou1euXusXcm1HU
```

#### 🧮 Bước 4: Kiểm tra số dư Token của bạn

Để xác nhận rằng token đã về đến ATA của bạn:
```bash
spl-token balance <TOKEN_MINT_ADDRESS>
```

#### 🎉 Vậy là xong!
Bạn vừa mới:  
+ Tạo một token SPL tùy chỉnh
+ Thiết lập Tài khoản Token Liên kết của bạn
+ Đúc token vào đó

Bây giờ bạn đã sẵn sàng để sử dụng token này trong dApp, hợp đồng thông minh của mình, hoặc chỉ đơn giản là gửi nó đi khắp nơi 🚀

### 3. Lấy và Tạo ATA với Anchor Typescript
Bây giờ bạn đã hiểu ATA là gì, tại sao chúng quan trọng và đã đúc thành công token SPL đầu tiên của mình bằng CLI, đã đến lúc thực hiện bước tiếp theo — làm việc với ATA bằng lập trình bằng **Anchor TypeScript**.

Thư viện `@solana/spl-token` cung cấp các công cụ bạn cần. Hãy xem các lệnh được sử dụng trong `test/bank-app.ts`: 
```ts
import { createAssociatedTokenAccountInstruction, getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
```

#### 🧮 Tìm hiểu về `getAssociatedTokenAddressSync`
Hàm này cho phép bạn tính toán địa chỉ ATA một cách xác định từ một token mint và một chủ sở hữu:
```ts
export function getAssociatedTokenAddressSync(
    mint: PublicKey,
    owner: PublicKey,
    allowOwnerOffCurve = false,
    programId = TOKEN_PROGRAM_ID,
    associatedTokenProgramId = ASSOCIATED_TOKEN_PROGRAM_ID,
): PublicKey {
    if (!allowOwnerOffCurve && !PublicKey.isOnCurve(owner.toBuffer())) throw new TokenOwnerOffCurveError();

    const [address] = PublicKey.findProgramAddressSync(
        [owner.toBuffer(), programId.toBuffer(), mint.toBuffer()],
        associatedTokenProgramId,
    );

    return address;
}
```
+ `mint`: Địa chỉ đúc (mint) của token.
+ `owner`: Ví hoặc PDA sẽ sở hữu tài khoản token liên kết.
+ `allowOwnerOffCurve`: Nếu là `true`, cho phép địa chỉ ngoài đường cong (tức là PDA hoặc địa chỉ không ký) làm chủ sở hữu. Mặc định là `false`.
+ `programId`: Chỉ định chương trình token nào sẽ sử dụng. Mặc định là `TOKEN_PROGRAM_ID` (SPL Token v1 cổ điển). Nếu bạn đang làm việc với các token sử dụng các tính năng như phí giao dịch hoặc giao dịch ẩn danh, bạn nên sử dụng `TOKEN_2022_PROGRAM_ID` mới hơn.
+ `associatedTokenProgramId`: ID chương trình token. Thường được để mặc định là `ASSOCIATED_TOKEN_PROGRAM_ID` cho cả hai tiêu chuẩn token.

Nếu bạn đang tạo ATA cho một PDA (như kho lưu trữ/vault), hãy nhớ đặt `allowOwnerOffCurve = true`, vì các PDA được thiết kế là ngoài đường cong.  
Ví dụ:
```ts
let tokenMint = new PublicKey("FBUoe8bLbPBh4VcF4jwg1L53XZBdSJoERry16u26UnNL") //bạn nên đặt token mint của mình ở đây
let userAta = getAssociatedTokenAddressSync(tokenMint, provider.publicKey)
let bankAta = getAssociatedTokenAddressSync(tokenMint, BANK_APP_ACCOUNTS.bankVault, true)
```

#### 🏗️ Tạo ATA với `createAssociatedTokenAccountInstruction`
Hàm này tạo ra một chỉ dẫn để khởi tạo một ATA trên chuỗi (on-chain):
```ts
export function createAssociatedTokenAccountInstruction(
    payer: PublicKey,
    associatedToken: PublicKey,
    owner: PublicKey,
    mint: PublicKey,
    programId = TOKEN_PROGRAM_ID,
    associatedTokenProgramId = ASSOCIATED_TOKEN_PROGRAM_ID,
): TransactionInstruction {
    return buildAssociatedTokenAccountInstruction(
        payer,
        associatedToken,
        owner,
        mint,
        Buffer.alloc(0),
        programId,
        associatedTokenProgramId,
    );
}
```

Các tham số chính:
+ `payer`: ví sẽ trả phí thuê (phải ký giao dịch).
+ `associatedToken`: ATA được lấy ra (từ `getAssociatedTokenAddressSync`).
+ Phần còn lại giống như những gì chúng ta đã giải thích ở trên.

#### 🧪 Kết hợp tất cả lại: Ví dụ trong bank-app.ts
Trong tệp kiểm tra của bạn, bạn có thể thấy một cái gì đó như thế này:
```ts
if (await provider.connection.getAccountInfo(bankAta) == null) {
  preInstructions.push(createAssociatedTokenAccountInstruction(
    provider.publicKey,
    bankAta,
    BANK_APP_ACCOUNTS.bankVault,
    tokenMint
  ))
}

const tx = await program.methods.depositToken(new BN(1_000_000_000))
  .accounts({
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
```

Đây là những gì sẽ diễn ra:
+ Trước khi chạy `depositToken`, cần kiểm tra xem `bankAta` có tồn tại trên chuỗi hay không.
+ Nếu không, instruction tạo ATA sẽ được thêm vào `preInstructions`.
+ Các `preInstructions` này chạy trước instruction `depositToken` chính, đảm bảo mọi thứ được thiết lập đúng cách.

⚠️ Nếu bạn bỏ qua bước `createAssociatedTokenAccountInstruction` và ATA không tồn tại, chương trình của bạn sẽ trả về lỗi — token không thể được gửi vào một tài khoản không tồn tại.

🎉 Chúc mừng! Bây giờ bạn đã:  
✅ Học cách lấy ATA bằng `@solana/spl-token`  
✅ Tạo ATA cho cả người dùng và các PDA do chương trình sở hữu    
✅ Tích hợp chỉ dẫn tạo ATA vào một giao dịch Anchor  

### 4. Đến lúc Xây dựng 💪
Bây giờ là lúc để áp dụng tất cả những gì bạn đã học! Bạn sẽ hoàn thành một loạt các bài tập có hướng dẫn để hoàn thiện Ứng dụng Ngân hàng. Bạn sẽ thêm logic để xử lý việc rút token và hoàn thành quy trình gửi/rút tiền đầy đủ bằng cách sử dụng ATA — giúp ứng dụng của bạn sẵn sàng hoạt động với các token SPL thực tế trên Solana.

🛠️ Nhiệm vụ của bạn: 
1. **Triển khai `token_transfer_from_pda` trong `transfer_helper.rs`**  
Hàm này sẽ chuyển bất kỳ token SPL nào (hiện tại là Token V1 cổ điển) từ một PDA (như `BankInfo`) trở lại người dùng.  
Hãy đảm bảo sử dụng `invoke_signed()` (giống như khi chuyển SOL từ PDA) và bao gồm các `signer_seeds` chính xác.

2. **Hoàn thành Lệnh rút Token (WithdrawToken)**  
Cho phép người dùng rút token SPL đã gửi của họ từ vault (PDA `BankInfo`) vào tài khoản token của chính họ.

3. **Viết các bài kiểm tra trong `bank-app.ts`**  
Và cuối cùng, đừng bao giờ quên viết bài kiểm tra! Xác nhận rằng logic rút tiền của bạn hoạt động như mong đợi bằng cách sử dụng bộ công cụ kiểm tra Anchor.

Sau khi giải quyết xong các nhiệm vụ này, Ứng dụng Ngân hàng của bạn sẽ hỗ trợ đầy đủ việc gửi và rút token SPL thông qua ATA.  
🚀 Hãy cùng bắt đầu xây dựng thôi!








