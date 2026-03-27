# Phần V - Versioned Transaction

Vậy là bạn đã hoàn thành 4 bài học cơ bản đầu tiên! Chúc mừng bạn! Đã đến lúc tìm hiểu sâu hơn về Solana. Hãy bắt đầu với bài học nâng cao đầu tiên: Versioned Transaction.

Tính năng này cho phép bạn bao gồm nhiều account hơn trong một giao dịch duy nhất, giúp xây dựng các giao thức DeFi phức tạp hơn, các sàn giao dịch NFT và các ứng dụng khác yêu cầu tương tác với nhiều tài khoản cùng lúc. 

Trong phần này, bạn sẽ:  
✅ Hiểu Versioned Transaction là gì và tại sao chúng quan trọng  
✅ Tìm hiểu về Bảng Tra cứu Địa chỉ (Address Lookup Tables - ALTs) và cách chúng hoạt động  
✅ Chuyển đổi các giao dịch cũ (legacy) sang Versioned Transaction trong Bank App của bạn  
✅ Xây dựng tính năng gửi tiền hàng loạt (batch deposit) sử dụng Versioned Transaction

Kết thúc phần này, bạn sẽ có thể tạo và gửi các Versioned Transaction, giúp gia tăng khả năng xây dựng các ứng dụng Solana phức tạp và hiệu quả hơn.  
Bắt đầu thôi! 🚀📦

### 🏦 Mở rộng Bank App: Các Hoạt động Hàng loạt với Versioned Transaction

Trong thế giới thực, các ngân hàng thường cần xử lý nhiều hoạt động cùng một lúc — như gửi tiền hàng loạt từ nhiều người dùng, hoặc xử lý nhiều lần chuyển token trong một giao dịch duy nhất. Tuy nhiên, các giao dịch Solana cũ có một hạn chế: chúng chỉ có thể bao gồm khoảng 35 tài khoản do giới hạn kích thước giao dịch 1.232 byte.

💡 Đó là lúc Versioned Transactions xuất hiện!

Trong phiên này, chúng ta sẽ nâng cấp Bank app để hỗ trợ gửi tiền hàng loạt bằng Versioned Transaction. Điều này sẽ cho phép người dùng gửi nhiều token trong một giao dịch duy nhất, giúp ứng dụng hiệu quả hơn và thân thiện hơn với người dùng.

### 1. Versioned Transaction là gì?

Versioned Transaction là một định dạng giao dịch nâng cao được giới thiệu trong Solana hỗ trợ Bảng Tra cứu Địa chỉ (ALTs). Điều này cho phép các giao dịch tham chiếu tới tối đa 256 tài khoản thay vì giới hạn ~35 tài khoản trong các giao dịch cũ.

#### 🧠 Tại sao chúng ta cần Versioned Transaction?

**Hạn chế của Giao dịch Cũ (Legacy):**

- Kích thước giao dịch tối đa: 1.232 byte
- Mỗi địa chỉ tài khoản là 32 byte
- Điều này giới hạn bạn ở mức xấp xỉ 35 tài khoản mỗi giao dịch
- Đây trở thành vấn đề khi bạn cần:
  - Xử lý nhiều lần chuyển token
  - Tương tác với nhiều tài khoản trong một thao tác duy nhất
  - Xây dựng các giao thức DeFi phức tạp yêu cầu nhiều tài khoản

**Lợi ích của Versioned Transaction:**

- Sử dụng Bảng Tra cứu Địa chỉ (Address Lookup Tables - ALTs) để nén các tham chiếu tài khoản
- Có thể bao gồm tới 256 tài khoản trong một giao dịch duy nhất
- Hiệu quả hơn đối với các thao tác phức tạp
- Thiết yếu cho các ứng dụng Solana hiện đại

#### 🧩 Bảng Tra cứu Địa chỉ hoạt động như thế nào?

Bảng Tra cứu Địa chỉ (ALT) là một tài khoản on-chain lưu trữ danh sách các khóa công khai. Thay vì bao gồm các địa chỉ 32 byte đầy đủ trong giao dịch của bạn, bạn có thể tham chiếu các tài khoản bằng chỉ mục (index) của chúng trong ALT (chỉ 1 byte cho các chỉ mục từ 0-255).

**Quy trình:**

1. **Tạo một ALT**: Triển khai một bảng tra cứu chứa các khóa công khai mà bạn sẽ thường xuyên sử dụng
2. **Tham chiếu bằng Chỉ mục**: Trong giao dịch của bạn, tham chiếu các tài khoản bằng chỉ mục ALT của chúng thay vì địa chỉ đầy đủ
3. **Nén Giao dịch**: Điều này làm giảm đáng kể kích thước giao dịch, cho phép bao gồm nhiều tài khoản hơn

Hãy nghĩ về nó giống như một danh bạ điện thoại — thay vì phải viết ra địa chỉ đầy đủ mỗi lần, bạn chỉ cần tham chiếu đến một số thứ tự.

### 2. Tìm hiểu các loại Giao dịch

Solana hỗ trợ hai loại giao dịch:

**Giao dịch Cũ (Version 0x00):**

- Định dạng giao dịch ban đầu
- Các tài khoản được bao gồm trực tiếp trong giao dịch
- Giới hạn ở ~35 tài khoản
- Vẫn được sử dụng rộng rãi và được hỗ trợ đầy đủ

**Versioned Transaction (Version 0x01):**

- Định dạng giao dịch mới
- Sử dụng Bảng Tra cứu Địa chỉ (ALTs)
- Hỗ trợ tới 256 tài khoản
- Được đề xuất cho các ứng dụng phức tạp

### 3. Tạo và Sử dụng Versioned Transaction

Hãy xem cách tạo và gửi các Versioned Transaction trong đoạn code client TypeScript của bạn.

#### 🛠️ Bước 1: Tạo một Bảng Tra cứu Địa chỉ (Address Lookup Table)

Trước tiên, bạn cần tạo một ALT để lưu trữ các tài khoản bạn muốn tham chiếu:

```typescript
import { 
  AddressLookupTableProgram, 
  TransactionMessage,
  VersionedTransaction,
  Connection,
  Keypair,
  PublicKey
} from "@solana/web3.js";

// Tạo một Bảng Tra cứu Địa chỉ mới
async function createLookupTable(
  connection: Connection,
  payer: Keypair
): Promise<PublicKey> {
  const [lookupTableInst, lookupTableAddress] = 
    AddressLookupTableProgram.createLookupTable({
      authority: payer.publicKey,
      payer: payer.publicKey,
      recentSlot: await connection.getSlot(),
    });

  const transaction = new Transaction().add(lookupTableInst);
  await connection.sendTransaction(transaction, [payer]);

  return lookupTableAddress;
}
```

#### 🛠️ Bước 2: Thêm các Tài khoản vào Bảng Tra cứu

Sau khi được tạo, bạn cần thêm các tài khoản vào ALT của mình:

```typescript
async function addAccountsToLookupTable(
  connection: Connection,
  payer: Keypair,
  lookupTable: PublicKey,
  accounts: PublicKey[]
): Promise<string> {
  const extendInstruction = AddressLookupTableProgram.extendLookupTable({
    payer: payer.publicKey,
    authority: payer.publicKey,
    lookupTable: lookupTable,
    addresses: accounts,
  });

  const transaction = new Transaction().add(extendInstruction);
  const signature = await connection.sendTransaction(transaction, [payer]);
  await connection.confirmTransaction(signature);
  return signature;
}
```

#### 🛠️ Bước 3: Tạo một Versioned Transaction

Bây giờ bạn có thể tạo một giao dịch phiên bản sử dụng ALT:

```typescript
async function createVersionedTransaction(
  connection: Connection,
  payer: Keypair,
  instructions: TransactionInstruction[],
  lookupTable: PublicKey
): Promise<VersionedTransaction> {
  const { blockhash, lastValidBlockHeight } = 
    await connection.getLatestBlockhash();
  
  const lookupTableAccount = await connection.getAddressLookupTable(lookupTable);
  if (!lookupTableAccount || !lookupTableAccount.value) {
    throw new Error("Lookup table not found or not activated yet");
  }
  // Biên dịch msg sang định dạng v0 với bảng tra cứu
  const messageV0 = new TransactionMessage({
    payerKey: payer.publicKey,
    recentBlockhash: blockhash,
    instructions: instructions,
  }).compileToV0Message([lookupTableAccount.value]);
  
  // Tạo một Versioned Transaction
  const transaction = new VersionedTransaction(messageV0);
  transaction.sign([payer]);

  return transaction;
}
```

#### 🛠️ Bước 4: Gửi Versioned Transaction

Cuối cùng, gửi giao dịch:

```typescript
async function sendVersionedTransaction(
  connection: Connection,
  transaction: VersionedTransaction
): Promise<string> {
  const signature = await connection.sendTransaction(transaction);
  await connection.confirmTransaction(signature);
  return signature;
}
```

### 4. Ví dụ: Gửi Token Hàng loạt (Batch Token Deposits)

Hãy áp dụng điều này vào Bank App. Chúng ta sẽ tạo một tính năng cho phép người dùng gửi nhiều loại token khác nhau trong một giao dịch duy nhất.

#### 🧱 Tổng quan

Thay vì thực hiện các giao dịch riêng biệt cho mỗi lần gửi token, người dùng có thể:

- Gửi nhiều SPL token cùng một lúc
- Tiết kiệm phí giao dịch
- Cải thiện trải nghiệm người dùng

#### 🛠️ Triển khai trong `bank-app.ts`

Dưới đây là cách bạn có thể triển khai gửi tiền hàng loạt sử dụng Versioned Transaction:

```typescript
import {
  AddressLookupTableProgram,
  TransactionMessage,
  VersionedTransaction,
  Transaction,
  TransactionInstruction,
  Connection,
  SystemProgram,
  PublicKey,
} from "@solana/web3.js";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { 
  getAssociatedTokenAddressSync, 
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID 
} from "@solana/spl-token";
import { BN } from "bn.js";

async function batchDepositTokens(
  connection: Connection,
  provider: AnchorProvider,
  program: Program<BankApp>,
  tokenMints: PublicKey[],
  amounts: InstanceType<typeof BN>[],
  BANK_APP_ACCOUNTS: {
    bankInfo: PublicKey;
    bankVault: PublicKey;
    userReserve: (pubkey: PublicKey, tokenMint?: PublicKey) => PublicKey;
  }
) {
  // Bước 1: Chuẩn bị tất cả các tài khoản cần thiết
  const accounts: PublicKey[] = [];
  const instructions: TransactionInstruction[] = [];
  
  // Thêm các tài khoản chung trước
  accounts.push(program.programId);
  accounts.push(SystemProgram.programId);
  accounts.push(TOKEN_PROGRAM_ID);
  accounts.push(BANK_APP_ACCOUNTS.bankInfo);
  accounts.push(BANK_APP_ACCOUNTS.bankVault);
  accounts.push(provider.publicKey);

  // Đối với mỗi token, chuẩn bị các tài khoản và chỉ dẫn
  for (let i = 0; i < tokenMints.length; i++) {
    const tokenMint = tokenMints[i];
    const amount = amounts[i];
    
    const userAta = getAssociatedTokenAddressSync(
      tokenMint,
      provider.publicKey
    );
    const bankAta = getAssociatedTokenAddressSync(
      tokenMint,
      BANK_APP_ACCOUNTS.bankVault,
      true
    );
    const userReserve = BANK_APP_ACCOUNTS.userReserve(
      provider.publicKey,
      tokenMint
    );

    // Thêm các tài khoản vào danh sách (tránh trùng lặp)
    const newAccounts = [tokenMint, userAta, bankAta, userReserve];
    for (const account of newAccounts) {
      if (!accounts.find(a => a.equals(account))) {
        accounts.push(account);
      }
    }

    // Kiểm tra xem ATA của bank đã tồn tại chưa, tạo nếu cần
    if (await connection.getAccountInfo(bankAta) == null) {
      instructions.push(
        createAssociatedTokenAccountInstruction(
          provider.publicKey,
          bankAta,
          BANK_APP_ACCOUNTS.bankVault,
          tokenMint
        )
      );
    }

    // Thêm instruction gửi tiền
    instructions.push(
      await program.methods
        .depositToken(amount)
        .accounts({
          bankInfo: BANK_APP_ACCOUNTS.bankInfo,
          bankVault: BANK_APP_ACCOUNTS.bankVault,
          tokenMint: tokenMint,
          userAta: userAta,
          bankAta: bankAta,
          userReserve: userReserve,
          user: provider.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .instruction()
    );
  }

  // Bước 2: Tạo hoặc lấy bảng tra cứu hiện có
  let lookupTable: PublicKey;
  // Trong thực tế, bạn sẽ muốn tái sử dụng một bảng tra cứu hiện có
  // Trong ví dụ này, chúng ta sẽ tạo một bảng mới
  const [lookupTableInst, lookupTableAddress] =
    AddressLookupTableProgram.createLookupTable({
      authority: provider.publicKey,
      payer: provider.publicKey,
      recentSlot: await connection.getSlot(),
    });

  const createTableTx = new Transaction().add(lookupTableInst);
  const createTableSig = await connection.sendTransaction(createTableTx, [provider.wallet.payer]);
  await connection.confirmTransaction(createTableSig);

  lookupTable = lookupTableAddress;

  // Đợi bảng tra cứu sẵn sàng
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Bước 3: Thêm các tài khoản vào bảng tra cứu
  const extendInstruction = AddressLookupTableProgram.extendLookupTable({
    payer: provider.publicKey,
    authority: provider.publicKey,
    lookupTable: lookupTable,
    addresses: accounts,
  });

  const extendTx = new Transaction().add(extendInstruction);
  const extendSig = await connection.sendTransaction(extendTx, [provider.wallet.payer]);
  await connection.confirmTransaction(extendSig);

  // Đợi việc mở rộng sẵn sàng
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Bước 4: Tạo Versioned Transaction
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash();

  // Lấy tài khoản bảng tra cứu (bắt buộc cho các Versioned Transaction)
  const lookupTableAccount = await connection.getAddressLookupTable(lookupTable);
  if (!lookupTableAccount || !lookupTableAccount.value) {
    throw new Error("Lookup table not found or not activated yet");
  }

  const messageV0 = new TransactionMessage({
    payerKey: provider.publicKey,
    recentBlockhash: blockhash,
    instructions: instructions,
  }).compileToV0Message([lookupTableAccount.value]);

  const versionedTransaction = new VersionedTransaction(messageV0);
  versionedTransaction.sign([provider.wallet.payer]);

  // Bước 5: Gửi giao dịch
  const signature = await connection.sendTransaction(versionedTransaction);
  await connection.confirmTransaction(signature);

  console.log("Tx :", signature);
  return signature;
}
```

#### ✅ Điều gì đang xảy ra ở đây?

1. **Thu thập tài khoản**: Chúng ta tập hợp tất cả các tài khoản duy nhất cần thiết cho tất cả các lần gửi token
2. **Xây dựng instruction**: Chúng ta tạo các instruction cho mỗi lần gửi token, bao gồm cả việc tạo ATA nếu cần
3. **Tạo bảng tra cứu**: Chúng ta tạo một ALT để lưu trữ tất cả các tài khoản này
4. **Mở rộng tài khoản**: Chúng ta thêm tất cả các tài khoản vào ALT
5. **Versioned Transaction**: Chúng ta biên dịch giao dịch sang định dạng v0 sử dụng ALT
6. **Thực thi**: Chúng ta gửi và xác nhận giao dịch

Cách tiếp cận này cho phép chúng ta gửi nhiều loại token trong một giao dịch duy nhất, điều này sẽ không thể thực hiện được với các giao dịch cũ nếu chúng ta vượt quá giới hạn tài khoản.

### 5. Khi nào nên sử dụng Versioned Transaction

Sử dụng versioned transaction khi:

- ✅ Bạn cần tương tác với nhiều hơn ~35 tài khoản trong một giao dịch duy nhất
- ✅ Bạn đang xây dựng các giao thực DeFi phức tạp
- ✅ Bạn muốn gộp (batch) nhiều hoạt động một cách hiệu quả
- ✅ Bạn đang xây dựng các sàn giao dịch NFT hoặc các ứng dụng đa tài khoản khác

Tiếp tục sử dụng giao dịch cũ (legacy) khi:

- ✅ Giao dịch của bạn có ít hơn ~35 tài khoản
- ✅ Bạn muốn khả năng tương thích tối đa
- ✅ Bạn đang xây dựng các ứng dụng đơn giản

### 6. Những lưu ý quan trọng

#### ⚠️ Vòng đời của Bảng Tra cứu 

- **Khởi tạo**: Tạo một ALT yêu cầu một giao dịch và mất thời gian để trở nên khả dụng
- **Mở rộng**: Bạn có thể thêm các tài khoản vào ALT sau đó, nhưng việc này cũng yêu cầu một giao dịch
- **Hủy kích hoạt**: ALTs có thể bị hủy kích hoạt (nhưng không bị xóa) bởi admin
- **Khả năng tái sử dụng**: Trong môi trường thực tế (production), hãy tái sử dụng các ALT hiện có thay vì tạo mới cho mỗi giao dịch

#### ⚠️ Xác nhận Giao dịch

Versioned Transaction hoạt động giống như giao dịch cũ trong việc xác nhận:

- Luôn đợi xác nhận trước khi coi là thành công
- Sử dụng `confirmTransaction` hoặc `getSignatureStatus` để kiểm tra
- Xử lý các lỗi một cách thích hợp

### 7. Đến lúc bắt tay vào xây dựng 💪

Bây giờ là lúc áp dụng tất cả những gì bạn đã học! Bạn sẽ hoàn thành một bộ bài tập có hướng dẫn để thêm hỗ trợ giao dịch phiên bản vào Bank app của bạn. Bạn sẽ sử dụng chương trình `bank-app` hiện có trong các bài học để thực hiện điều này.

🛠️ Nhiệm vụ của bạn:

1. **Tạo một Hàm Hỗ trợ cho các Bảng Tra cứu**
  Viết một hàm có thể tái sử dụng để:
  - Tạo một ALT nếu nó chưa tồn tại
  - Mở rộng nó với các tài khoản mới nếu cần
  - Trả về địa chỉ bảng tra cứu
  - Xử lý thời gian/chờ đợi cho việc kích hoạt ALT
2. **Triển khai Gửi Token Hàng loạt**
  Tạo một hàm cho phép người dùng gửi nhiều loại token trong một Versioned Transaction duy nhất:
  - Chấp nhận một mảng các mint token và số lượng
  - Tạo tất cả các instruction cần thiết
  - Sử dụng một bảng tra cứu để nén giao dịch
  - Gửi dưới dạng Versioned Transaction
3. **Thêm Gửi SOL Hàng loạt**
  Mở rộng chức năng hàng loạt để hỗ trợ gửi nhiều lần SOL từ những người dùng khác nhau hoặc các thao tác hàng loạt cho cùng một người dùng.
4. **Viết các bài kiểm thử**
  Như thường lệ, hãy viết các bài kiểm thử:
  - Kiểm thử việc gửi token hàng loạt với 2-3 loại token khác nhau
  - Xác minh tất cả các giao dịch gửi tiền thành công
  - Kiểm thử việc xử lý lỗi (ví dụ: số dư không đủ)
  - Thử nghiệm với các giao dịch cũ để so sánh
5. **Tối ưu hóa cho Sản phẩm**
  Cân nhắc các cải tiến:
  - Tái sử dụng các bảng tra cứu thay vì tạo mới
  - Lưu trữ (cache) các địa chỉ bảng tra cứu
  - Xử lý việc mở rộng bảng tra cứu hiệu quả hơn

Khi bạn đã hoàn thành các nhiệm vụ này, Bank App của bạn sẽ hỗ trợ các hoạt động hàng loạt hiệu quả bằng cách sử dụng Versioned Transaction — một tính năng then chốt cho các ứng dụng Solana sẵn sàng cho môi trường thực tế! 🚀

### 🎓 Các điểm chính cần ghi nhớ

- Các Versioned Transaction sử dụng Bảng Tra cứu Địa chỉ để hỗ trợ tới 256 tài khoản
- Các ALT nén các tham chiếu tài khoản, làm giảm kích thước giao dịch
- Versioned Transaction là thiết yếu cho các ứng dụng DeFi phức tạp và đa tài khoản
- Luôn đợi kích hoạt ALT trước khi sử dụng nó trong các giao dịch
- Tái sử dụng các bảng tra cứu trong thực tế để đạt hiệu quả cao

