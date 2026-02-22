# 07 – Thứ tự Chỉ dẫn, Sysvar & Các Ràng buộc Runtime

Trong bài học này, chúng ta sẽ đi sâu vào cách Solana thực thi các chỉ dẫn trong một giao dịch và tại sao thứ tự của các chỉ dẫn đó lại quan trọng. Bạn sẽ học cách sử dụng tài khoản **Sysvar Instructions** để tự kiểm tra chỉ dẫn (instruction introspection), cho phép các chương trình on-chain của bạn kiểm tra và thực thi các ràng buộc đối với giao dịch mà chúng đang chạy.

---

Trước khi bắt đầu bài học này, bạn nên nắm vững:

- **PDAs (Program Derived Addresses)** – Hiểu cách các chương trình tạo ra và sở hữu tài khoản
- **ATAs (Associated Token Accounts)** – Các mô hình quản lý tài khoản token
- **CPI (Cross-Program Invocation)** – Cách các chương trình gọi các chương trình khác
- **Cấu trúc giao dịch** – Các tài khoản, người ký, chỉ dẫn
Nếu bạn cần ôn lại, hãy xem lại các bài học trước (03, 04, 05) trong khóa học này.

---

Đến cuối bài học này, bạn sẽ nắm được:

- Cách Solana thực thi các chỉ dẫn: tuần tự và nguyên tử (atomic)
- Tại sao thứ tự chỉ dẫn ảnh hưởng đến bảo mật, tính chính xác và khả năng kết hợp
- Cách sử dụng tài khoản Sysvar Instructions để tự kiểm tra chỉ dẫn
- Cách thực thi thứ tự chỉ dẫn bên trong các chương trình on-chain
- Khi nào nên sử dụng `invoke_signed` thay vì CPI để kiểm soát sự tăng trưởng của ngăn xếp chỉ dẫn (instruction stack)
- Cách kích thước ngăn xếp và giới hạn tài khoản của Solana ảnh hưởng đến các giao dịch phức tạp
- Các chiến lược thực tế để thiết kế giao dịch không vượt quá giới hạn runtime
- Cách kiểm tra và gỡ lỗi các giao dịch phụ thuộc vào thứ tự chỉ dẫn

---

## Cách Solana thực thi các Giao dịch 

Một giao dịch Solana là một tập hợp các chỉ dẫn được thực thi tuần tự bởi runtime, nó thực thi chúng **theo thứ tự**, **từng cái một**:

```
Transaction {
  instructions: [Ix0, Ix1, Ix2, Ix3]
}

Thực thi:
1. Ix0 thực thi → sửa đổi tài khoản → thành công
2. Ix1 thực thi → sửa đổi tài khoản → thành công
3. Ix2 thực thi → sửa đổi tài khoản → thành công
4. Ix3 thực thi → sửa đổi tài khoản → thành công

Kết quả: Giao dịch thành công, tất cả thay đổi tài khoản được ghi nhận.
```
Và giao dịch mang tính **nguyên tử (atomic)**. Nếu một chỉ dẫn đơn lẻ thất bại, toàn bộ giao dịch sẽ thất bại và không có thay đổi nào được thực hiện.
Hãy nghĩ về một giao dịch như một giao dịch cơ sở dữ liệu nguyên tử duy nhất với nhiều thao tác:

```
BEGIN TRANSACTION;
  operation1();  -- Ix0
  operation2();  -- Ix1
  operation3();  -- Ix2
COMMIT;
```

Nếu `operation2()` thất bại, toàn bộ quá trình sẽ được hoàn tác (roll back).

Ví dụ: Sửa đổi Trạng thái Tuần tự

```rust
// Chỉ dẫn 0: Khởi tạo bộ đếm về 0
counter.value = 0;

// Chỉ dẫn 1: Tăng bộ đếm
counter.value += 1;  // Bây giờ là 1

// Chỉ dẫn 2: Tăng bộ đếm
counter.value += 1;  // Bây giờ là 2

// Giao dịch thành công, counter.value = 2
```

Trạng thái cuối cùng phụ thuộc vào thứ tự thực thi. Nếu Ix1 và Ix2 chạy trước Ix0, bộ đếm sẽ bằng 0.

---

## Tại sao Thứ tự Chỉ dẫn lại Quan trọng

Thứ tự chỉ dẫn ảnh hưởng đến ba lĩnh vực quan trọng:

### 1. Tính Chính xác

Các chương trình thường có sự phụ thuộc logic giữa các thao tác:

``` RUST
Thứ tự sai:
1. Chuyển token
2. Xác minh chữ ký  ❌ Quá muộn!

Thứ tự đúng:
1. Xác minh chữ ký
2. Chuyển token   ✅ An toàn
```

### 2. Bảo mật

```rust
// ❌ SAI: Kiểm tra sau khi thay đổi dữ liệu
pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
    // Thay đổi dữ liệu trước
    ctx.accounts.vault.balance -= amount;
    ctx.accounts.user.balance += amount;
    
    // Kiểm tra sau
    require!(ctx.accounts.authority.is_signer ErrorCode::Unauthorized);
    
    Ok(())
}
```
Chúng ta luôn xác minh các điều kiện tiên quyết (preconditions) trước khi thay đổi trạng thái. Cách sửa:
```rust
// ✅ ĐÚNG: Kiểm tra trước khi thay đổi dữ liệu
pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
    // Kiểm tra trước
    require!(ctx.accounts.authority.is_signer, ErrorCode::Unauthorized);
    require!(ctx.accounts.vault.balance >= amount, ErrorCode::InsufficientFunds);
    
    // Sau đó mới thay đổi dữ liệu
    ctx.accounts.vault.balance -= amount;
    ctx.accounts.user.balance += amount;
    
    Ok(())
}
```


### 3. Khả năng Kết hợp (Composability)

Khi chương trình của bạn được gọi qua CPI, bạn cần đảm bảo:

- **Các điều kiện tiên quyết (Preconditions)** được đáp ứng trước khi chỉ dẫn của bạn chạy
- **Các điều kiện sau (Postconditions)** được giữ vững sau khi chỉ dẫn của bạn hoàn thành
- **Các bất biến (Invariants)** được duy trì qua các ranh giới chỉ dẫn

Ví dụ: Một chương trình swap của DEX nên xác minh độ trượt giá (slippage) *trước khi* thực hiện swap, chứ không phải sau đó.

---

## Tài khoản Sysvar Instruction

**Sysvar Instruction** là một tài khoản đặc biệt chứa thông tin về tất cả các chỉ dẫn trong giao dịch hiện tại.

**Program ID**: `Sysvar1nstructions1111111111111111111111111` 

Nó cung cấp:
- Chỉ mục (index) của chỉ dẫn hiện tại
- Tổng số lượng chỉ dẫn
- Program ID, các tài khoản và dữ liệu cho mỗi chỉ dẫn
- Những chương trình nào đang được gọi

Vậy, khi nào nên sử dụng nó?
- Bạn muốn một chỉ dẫn phải là chỉ dẫn đầu tiên, chỉ dẫn cuối cùng hoặc chỉ dẫn duy nhất trong một giao dịch.
- Bạn muốn người ký chỉ có thể được ủy quyền bằng cách gọi trực tiếp qua chương trình này, không thể được gọi bởi CPI.
- Xác minh các chỉ dẫn cụ thể đã chạy trước chỉ dẫn của bạn
- Buộc người dùng thực hiện các bước theo đúng thứ tự trong một giao dịch

Đây là cách bạn triển khai nó:
```rust
use solana_program::sysvar::instructions;

// Lấy chỉ mục của chỉ dẫn hiện tại
let current_index = instructions::load_current_index_checked(ix_account)?;

// Tải một chỉ dẫn cụ thể
let instruction = instructions::load_instruction_at_checked(index,ix_account)?;
```

### Ví dụ
Khi một chỉ dẫn chạm tới giới hạn ngăn xếp (stack limit), bạn có thể đơn giản là chia một chỉ dẫn thành hai, với sysvar đóng vai trò là ràng buộc. Ở đây giả sử bạn buộc một hàm gửi tiền (deposit) phải diễn ra trước một hàm rút tiền (withdraw):

```rust
use anchor_lang::prelude::*;
use solana_program::sysvar::instructions as ix_sysvar;

declare_id!("Your11111111111111111111111111111111111111");

// Trong mã thực tế, tính toán giá trị này một lần off-chain qua Anchor và dán vào đây.
const DEPOSIT_DISCRIMINATOR: [u8; 8] = [0; 8]; // TODO: điền các byte thực tế

#[program]
pub mod simple_flow {
    use super::*;

    pub fn deposit(_ctx: Context<Deposit>, _amount: u64) -> Result<()> {
        // ... logic gửi tiền thông thường của bạn ...
        Ok(())
    }

    pub fn withdraw(ctx: Context<Withdraw>, _amount: u64) -> Result<()> {
        // --- 1) Đọc chỉ mục của chỉ dẫn hiện tại ---
        let ix_acc = &ctx.accounts.instructions.to_account_info();
        let current_index = ix_sysvar::load_current_index_checked(ix_acc)?;

        // Chúng ta cần ít nhất một chỉ dẫn trước chỉ dẫn này
        require!(current_index > 0, ErrorCode::MustDepositFirst);

        // --- 2) Tải chỉ dẫn phía trước ---
        let prev_ix = ix_sysvar::load_instruction_at_checked(
            (current_index - 1) as usize,
            ix_acc,
        )?;

        // Phải đến từ chương trình này
        require!(prev_ix.program_id == crate::ID, ErrorCode::MustDepositFirst);

        // --- 3) Kiểm tra discriminator = `deposit` ---
        require!(prev_ix.data.len() >= 8, ErrorCode::MustDepositFirst);
        let disc = &prev_ix.data[0..8];
        require!(disc == DEPOSIT_DISCRIMINATOR, ErrorCode::MustDepositFirst);

        // --- 4) Bây giờ thực hiện logic rút tiền thông thường ---
        // ... logic rút tiền của bạn ở đây ...

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    // bất kỳ tài khoản nào bạn cần
    pub user: Signer<'info>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    // bất kỳ tài khoản nào bạn cần
    pub user: Signer<'info>,

    /// CHECK: instructions sysvar
    #[account(address = solana_program::sysvar::instructions::ID)]
    pub instructions: UncheckedAccount<'info>,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Giao dịch phải có một lệnh gửi tiền ngay trước khi rút tiền")]
    MustDepositFirst,
}
```

## Các mô hình Phổ biến
### Mô hình 1: Phải là Chỉ dẫn Đầu tiên

```rust
let current = instructions::load_current_index_checked(ixs)?;
require!(current == 0, ErrorCode::MustBeFirst);
```

### Mô hình 2: Phải có Chỉ dẫn Phía trước

```rust
let current = instructions::load_current_index_checked(ixs)?;
require!(current > 0, ErrorCode::NoPreviousInstruction);

let prev = instructions::load_instruction_at_checked(current - 1, ixs)?;
// Kiểm tra prev.program_id, prev.data, v.v.
```

### Mô hình 3: Đếm Tổng số Chỉ dẫn

```rust
let mut total = 0;
loop {
    match instructions::load_instruction_at_checked(total, ixs) {
        Ok(_) => total += 1,
        Err(_) => break,
    }
    if total >= 64 { break; }  // Giới hạn tối đa của Solana
}

require!(total <= 5, ErrorCode::TooManyInstructions);
```
## Các Ràng buộc Runtime: Độ sâu Ngăn xếp & Giới hạn Tài khoản
Khi bạn bắt đầu thực thi thứ tự chỉ dẫn và kết hợp nhiều chỉ dẫn trong một giao dịch duy nhất, bạn sẽ nhanh chóng gặp phải các giới hạn runtime của Solana:

- **Độ sâu ngăn xếp lệnh gọi chỉ dẫn (Instruction call stack depth)**
- **Số lượng tài khoản tối đa mỗi chỉ dẫn**
- **Giới hạn ngân sách tính toán (Compute budget limits)**
- **Vi phạm truy cập trong khung ngăn xếp (Access violation in stack frame)**
...
### Độ sâu lệnh gọi CPI - Lỗi CallDepth
Các lệnh gọi chương trình chéo cho phép các chương trình gọi trực tiếp các chương trình khác, nhưng độ sâu hiện bị giới hạn ở mức 4.
Điều này có nghĩa là:
```
Transaction instruction (độ sâu 0)
  → Program A (độ sâu 1)
    → CPI tới Program B (độ sâu 2)
      → CPI tới Program C (độ sâu 3)
        → CPI tới Program D (độ sâu 4)
          → ❌ CPI tới Program E sẽ thất bại!
```

### Độ sâu ngăn xếp lệnh gọi - Lỗi CallDepthExceeded
Các chương trình Solana bị ràng buộc phải chạy nhanh, và để tạo điều kiện cho việc này, ngăn xếp lệnh gọi của chương trình bị giới hạn ở độ sâu tối đa 64 khung (frames).

Khi một chương trình vượt quá giới hạn độ sâu ngăn xếp lệnh gọi cho phép, nó sẽ nhận được lỗi `CallDepthExceeded`.



### Giới hạn Tài khoản cho mỗi Chỉ dẫn
Tối đa **30 tài khoản** mỗi chỉ dẫn nếu sử dụng giao dịch cũ (bao gồm cả các tài khoản trùng lặp).


### Kích thước Giao dịch

**Giới hạn**: Kích thước giao dịch tối đa là **1232 byte** (legacy) hoặc **1280 byte** (v0)

Điều này ảnh hưởng đến:
- Số lượng chỉ dẫn
- Số lượng tài khoản
- Kích thước dữ liệu chỉ dẫn
- Số lượng chữ ký


### Các lỗi "Access Violation in Stack Frame"

BPF runtime của Solana chỉ cấp cho mỗi trình xử lý chỉ dẫn 4 KiB không gian ngăn xếp (stack space). Macro derive của Anchor giải tuần tự hóa tất cả các trường trong struct `Accounts` của bạn — bao gồm cả dữ liệu tài khoản và các đối số chỉ dẫn — vào ngăn xếp. Nếu có quá nhiều trường hoặc các tài khoản rất lớn, điều này có thể vượt quá giới hạn 4 KiB và gây ra lỗi runtime “Access violation in stack frame”, tương đương với một lỗi tràn ngăn xếp (stack overflow).

Nó sẽ trông như thế này, nếu bạn từng gặp phải:
```
Program {program_address} invoke [1]
Program log: Instruction: Foo
Program {program_address} consumed 7000 of 1000000 compute units
Program failed to complete: Access violation in stack frame 7 at address 0x200007fd8 of size 8 by instruction #4170
Program {program_address} failed: Program failed to complete
```

## invoke_signed - CPI
### Vấn đề với chuỗi CPI 

Khi bạn sử dụng `CpiContext` của Anchor, bạn đang xây dựng một lệnh gọi CPI làm tăng độ sâu của ngăn xếp lệnh gọi:

```rust
// Đây là CPI (làm tăng độ sâu ngăn xếp lệnh gọi)
let cpi_ctx = CpiContext::new_with_signer(
    ctx.accounts.token_program.to_account_info(),
    Transfer {
        from: ctx.accounts.vault.to_account_info(),
        to: ctx.accounts.user.to_account_info(),
        authority: ctx.accounts.vault_authority.to_account_info(),
    },
    signer_seeds,
);

token::transfer(cpi_ctx, amount)?;
```
Khi sử dụng CPI, ngăn xếp sẽ là: 
```
Mã của bạn
 → Anchor wrapper
   → SPL Token wrapper
     → invoke_signed
       → SPL Token program
```

### Giải pháp: invoke_signed

`invoke_signed` là một hàm cấp thấp hơn có thể hiệu quả hơn cho các thao tác đơn giản, bằng cách sử dụng `invoke_signed`, ngăn xếp sẽ nông hơn:

```rust
use solana_program::program::invoke_signed;

// Đây là lệnh gọi invoke_signed trực tiếp (hiệu quả hơn)
let ix = spl_token::instruction::transfer(
    &spl_token::ID,
    &ctx.accounts.vault.key(),
    &ctx.accounts.user.key(),
    &ctx.accounts.vault_authority.key(),
    &[],
    amount,
)?;

invoke_signed(
    &ix,
    &[
        ctx.accounts.vault.to_account_info(),
        ctx.accounts.user.to_account_info(),
        ctx.accounts.vault_authority.to_account_info(),
        ctx.accounts.token_program.to_account_info(),
    ],
    &[signer_seeds],
)?;
```


## Xử lý việc Tràn bộ nhớ (Overflow)

#### Bảng Tra cứu (Nâng cao)

Sử dụng Bảng Tra cứu Địa chỉ (Address Lookup Tables) từ các giao dịch phiên bản (đã được học trong Bài 06):

```typescript
// Tạo bảng tra cứu với nhiều tài khoản
const lookupTable = await createLookupTable(connection, authority, [
  account1, account2, /* ... thêm 200 tài khoản khác ... */
]);

// Sử dụng trong giao dịch (tính là 1 tham chiếu tài khoản)
const ix = await program.methods
  .processMany()
  .accounts({ /* ... */ })
  .instruction();

const message = new TransactionMessage({
  payerKey: authority.publicKey,
  recentBlockhash: blockhash,
  instructions: [ix],
}).compileToV0Message([lookupTable]);

const tx = new VersionedTransaction(message);
```

### Tối ưu hóa Khung Ngăn xếp (Stack Frame Optimization)
Để tối ưu hóa việc sử dụng bộ nhớ trong Solana, bạn có thể sử dụng các kỹ thuật sau:

#### Zero-Copy
Khi một tài khoản trở nên rất lớn (thường là sau khi được mở rộng qua nhiều giao dịch), việc tải nó một cách bình thường với `Account<T>` hoặc thậm chí `Box<Account<T>>` có thể gây ra lỗi thiếu bộ nhớ hoặc vi phạm ngăn xếp, vì Anchor cố gắng giải tuần tự hóa toàn bộ tài khoản vào bộ nhớ của chương trình.

Zero-copy giúp tránh điều đó. Thay vì sao chép dữ liệu vào ngăn xếp (stack) hoặc vùng nhớ heap, chương trình của bạn đọc các byte trực tiếp từ bộ đệm bộ nhớ của tài khoản. Về cơ bản, bạn không di dời ngọn núi, bạn làm việc trực tiếp tại nơi ngọn núi đang đứng.

Thông thường, khi bạn viết:
```rust
let vault = &mut ctx.accounts.vault;
```
Anchor cung cấp một struct Rust nằm trên ngăn xếp.
Nếu struct tài khoản nhỏ, thì không vấn đề gì. Nhưng điều gì sẽ xảy ra nếu nó trở nên lớn:
```rust
#[account]
pub struct BigData {
    pub owner: Pubkey,
    pub values: [u64; 2000],   // <- rất lớn!
}
```
thì mỗi khi một chỉ dẫn tải nó, Rust cố gắng sao chép tất cả thứ đó vào ngăn xếp.

Với zero-copy, bạn trỏ trực tiếp vào dữ liệu tài khoản:
```rust
#[account(zero_copy)]
#[repr(packed)]
pub struct BigData {
    pub owner: Pubkey,
    pub values: [u64; 2000],
}
```
Và thay vì `Account<T>`, chúng ta sử dụng `AccountLoader<BigData>`.

Sau đó chúng ta truy cập nó như thế này:
```rust
let mut data = ctx.accounts.big_data.load_mut()?;
```

Vậy tại sao chúng ta không sử dụng Zero-Copy mọi lúc?
Chúng ta chỉ sử dụng khi lưu trữ dữ liệu có cấu trúc với kích thước cố định như: 
- các vị thế (positions)
- sổ lệnh (order books)
- các mảng lớn
- bộ đệm lịch sử (history buffer)

Chúng ta không sử dụng nếu:
- bạn dự định bố cục (layout) sẽ thay đổi sau này
- bạn muốn mã nguồn đơn giản, an toàn hơn
- bạn cần các trường dữ liệu động:
  - Vec<T>
  - String
  - dữ liệu tùy chọn / có độ dài thay đổi

#### Cấp phát Tài khoản lớn trên Heap
Nói chung, một thực hành tốt là cấp phát các tài khoản lớn hơn trên vùng nhớ heap. Mặc dù bạn không thể cấp phát các chương trình theo cách này và các tài khoản heap cần được giải tuần tự hóa (Vì vậy bạn không thể thực hiện điều đó trên các Unchecked Accounts), phương pháp này có thể tiết kiệm một lượng đáng kể không gian ngăn xếp.
``` rust
Box<Account<'info,BigAccount>>
```
Sử dụng cách này khi tài khoản:
- Lớn
- Cần được sửa đổi 
- Quá lớn đối với ngăn xếp

Nhưng điều này sẽ tốn thêm một lượng tài nguyên tính toán, vì vậy hãy đảm bảo bạn có kế hoạch rõ ràng.

#### Sử dụng hàm hỗ trợ (Helper function)
Đợi đã, có phải nhiều hàm hơn = nhiều khung ngăn xếp hơn??? Đúng, nhưng tại một thời điểm chỉ có một trong những khung đó tồn tại.
Mẹo ở đây không phải là giảm độ sâu, mà là giảm **kích thước khung (frame size)**.

```rust
fn monster() {
    let huge_a: [u8; 20_000];
    let huge_b: [u8; 20_000];
    let huge_c: [u8; 20_000];

    do_something(&huge_a);
    do_something_else(&huge_b);
    do_another(&huge_c);
}
```
Cả ba mảng này đều nằm trong cùng một khung ngăn xếp. Thậm chí nếu chúng được sử dụng tại các thời điểm khác nhau, trình biên dịch vẫn dự trữ không gian cho tất cả chúng **cùng một lúc**. 


```rust
fn monster() {
    sub_a();
    sub_b();
    sub_c();
}

#[inline(never)]
fn sub_a() {
    let huge_a: [u8; 20_000];
    do_something(&huge_a);
}

#[inline(never)]
fn sub_b() {
    let huge_b: [u8; 20_000];
    do_something_else(&huge_b);
}

#[inline(never)]
fn sub_c() {
    let huge_c: [u8; 20_000];
    do_another(&huge_c);
}
```


Bây giờ trong runtime, ngăn xếp trông như thế này:
```
monster frame
  -> sub_a frame (huge_a)
monster frame
  -> sub_b frame (huge_b)
monster frame
  -> sub_c frame (huge_c)
```

Điều này không được đảm bảo bởi trình biên dịch Rust, bạn có thể thực thi nó bằng cách sử dụng `#[inline(never)]` để gợi ý mạnh mẽ trình biên dịch không inlining một hàm cụ thể, điều này có khả năng làm sập chương trình.



#### Sử dụng Remaining Accounts
Đây không trực tiếp là một cách để xử lý vi phạm khung ngăn xếp, mà giống như việc ngăn chặn `Context` của bạn sử dụng bộ nhớ khổng lồ.

Bạn chỉ đưa những tài khoản mà bạn **luôn luôn** cần vào struct `Accounts`. Bất cứ thứ gì tùy chọn hoặc là biến số, sẽ đưa vào `remaining_accounts`.

Lý do chúng ta sử dụng `remaining_accounts` là vì mọi thứ bạn đưa vào struct `Accounts` sẽ nằm trong ngăn xếp, trong khi `remaining_accounts` sẽ nằm trong heap.

``` rust
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct MyDynamicIx<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,

    /// Thu thập tất cả các tài khoản bổ sung ở đây
    #[account(mut)]
    pub remaining_accounts: Vec<AccountInfo<'info>>,
}

pub fn my_dynamic_ix(ctx: Context<MyDynamicIx>) -> Result<()> {
    for acc in ctx.remaining_accounts.iter() {
        msg!("Extra account: {}", acc.key());
    }
    Ok(())
}
```


```typescript
// extraPubkeys: PublicKey[] từ logic nghiệp vụ của bạn
const remainingAccounts = extraPubkeys.map(pk => ({
  pubkey: pk,
  isWritable: true,
  isSigner: false,
}));

await program.rpc.myDynamicIx({
  accounts: {
    payer: provider.wallet.publicKey,
    systemProgram: anchor.web3.SystemProgram.programId,
  },
  remainingAccounts,
});
```



#### Đừng sử dụng AccountInfo

Nếu vì lý do nào đó, bạn không xác thực hoặc kiểm tra một tài khoản cụ thể (có lẽ nó không được truy cập trực tiếp hoặc nó đang được xác thực bởi một chỉ dẫn khác), bạn có thể sử dụng `UncheckedAccount<’info>` thay vì `AccountInfo<’info>`. Nó phục vụ cùng một mục đích trong ngữ cảnh này, thể hiện rõ ràng hơn về việc không thực hiện kiểm tra, và chiếm ít không gian hơn đáng kể.




## Gỡ lỗi (Debugging) 

### 1. Log Chỉ mục của Chỉ dẫn

```rust
let current = instructions::load_current_index_checked(ixs)?;
msg!("Chỉ mục chỉ dẫn hiện tại: {}", current);
```

### 2. Mô phỏng trước khi Gửi

```typescript
const simulation = await connection.simulateTransaction(tx, [wallet.payer]);

if (simulation.value.err) {
  console.error("Thất bại:", simulation.value.err);
  console.log("Logs:", simulation.value.logs);
}
```

### 3. Kiểm tra Nhật ký Giao dịch (Transaction Logs)

```
Program YourProgram invoke [1]
Program log: Current instruction index: 0
Program YourProgram success
```





## Bài tập
Trong bài tập này, bạn sẽ triển khai một **hệ thống phê duyệt tuần tự (sequential approval system)** yêu cầu hai chỉ dẫn theo thứ tự, sau đó tối ưu hóa nó với zero-copy để xử lý dữ liệu lớn.

### Phần 1: Phê duyệt Tuần tự
Xây dựng một hệ thống mà lệnh `execute` chỉ có thể chạy nếu lệnh `approve` đã chạy ngay trước nó trong cùng một giao dịch.
1. Tạo một chỉ dẫn `approve` để ghi lại sự phê duyệt
2. Tạo một chỉ dẫn `execute` để:
   - Kiểm tra xem chỉ dẫn trước đó có phải là `approve` không
   - Xác minh xem nó có đến từ cùng một chương trình không
   - Chỉ thực thi nếu sự phê duyệt là hợp lệ




### Phần 2: Tối ưu hóa với Zero-Copy
Bây giờ tạo một phiên bản xử lý dữ liệu lớn một cách hiệu quả bằng cách sử dụng zero-copy.

Yêu cầu:
- Thêm một struct `LargeApprovalData` với mảng gồm 512 giá trị `u64`
- So sánh `Account<T>` thông thường vs `AccountLoader<T>`
- Đo lường xem phương pháp nào tránh được tràn ngăn xếp. Quan sát cách một `Account<T>` thông thường quy mô lớn gặp lỗi giới hạn ngăn xếp BPF tại thời điểm build, trong khi một `AccountLoader<T>` zero-copy có thể xử lý cùng một kích thước dữ liệu một cách an toàn.
