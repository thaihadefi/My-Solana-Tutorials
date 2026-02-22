# Phần III - PDA

Bây giờ bạn đã cảm thấy dễ dàng khi viết các smart contract Solana cơ bản, đã đến lúc giới thiệu một trong những khái niệm quan trọng nhất trong phát triển Solana — Program Derived Addresses - PDAs. Các account đặc biệt này là chìa khóa để xây dựng các chương trình an toàn, có trạng thái (stateful) có thể lưu trữ dữ liệu người dùng, quản lý kho lưu trữ (vaults), kiểm soát thẩm quyền, và hơn thế nữa.

### Trong phần này, bạn sẽ:
✅ Hiểu PDA là gì và cách chúng hoạt động  
✅ Khởi tạo các account bằng cách sử dụng PDA với seeds và bump  
✅ Học cách lấy PDA trong Anchor TS Client.  
✅ Hoàn thành ví dụ thực tế đầu tiên: Ứng dụng Ngân hàng (Bank App)  

Đến cuối phần này, bạn sẽ có thể tự tin tạo và quản lý các PDA trong các smart contract Solana của mình, mở khóa khả năng xây dựng các smart contract mạnh mẽ và phức tạp hơn.  
Bắt đầu thôi! 🧠✨

### Hãy bắt đầu với một ví dụ thực tế: Ứng dụng Ngân hàng 🏦
Để hiểu cách PDA hoạt động trong thực tế, hãy xem xét một chương trình ngân hàng đơn giản trên Solana.  
Trong ứng dụng này:

👤 Người dùng có thể gửi và rút SOL  
🛑 Admin có thể tạm dừng chương trình để dừng mọi hoạt động trong trường hợp khẩn cấp  
💾 Chương trình nên lưu trữ:
- Config trong một PDA gọi là `BankInfo`
- Số tiền đã gửi của mỗi người dùng trong các PDA riêng lẻ gọi là `UserReserve`


### 1. PDA là gì?
Program Derived Address (PDA) là một loại account Solana đặc biệt được sở hữu bởi một chương trình, không phải bởi một ví trên đường cong (ví người dùng) có khóa bí mật (private key). Điều này làm cho PDA trở thành xương sống của hầu hết các smart contract Solana — chúng cho phép chương trình của bạn quản lý trạng thái, tài sản và thẩm quyền một cách an toàn mà không phụ thuộc vào các ví sở hữu bên ngoài.

Các PDA:  
🔐 *Được kiểm soát bởi chương trình của bạn* — không có khóa bí mật, chỉ chương trình mới có thể truy cập vào các PDA của nó và không ai có thể giả mạo chữ ký của nó.  
🧠 *Có tính xác định (Deterministic)* — chúng được tạo bằng các đầu vào cố định (gọi là `seeds`) cộng với ID chương trình của bạn.  
✍️ *Có khả năng ký giao dịch* — nhưng chỉ bằng cách sử dụng `invoke_signed()` với các `seeds` của PDA bên trong chương trình của bạn.

Trong chương trình ngân hàng của chúng ta, chúng ta sử dụng hai PDA để lưu trữ dữ liệu trong `state.rs`:
```rust
#[account]
#[derive(Default)]
pub struct BankInfo {
    pub authority: Pubkey,
    pub is_paused: bool,
    pub bump: u8,
}

#[account]
#[derive(Default)]
pub struct UserReserve {
    pub deposited_amount: u64,
}
```

- `BankInfo` là một PDA lưu trữ trạng thái của smart contract: ai là `authority`, trạng thái của smart contract có phải `is_paused` hay không, và giá trị `bump` của Bank Vault.
- `UserReserve` là một PDA dành riêng cho người dùng để theo dõi lượng SOL mà mỗi người dùng đã gửi.

Các PDA này được lấy ra bằng cách sử dụng hạt giống (seeds) và một số ngẫu nhiên gọi là bump. Vậy bump là gì — và tại sao chúng ta lại lưu trữ nó?

Khi tạo một PDA, Solana yêu cầu địa chỉ được tạo ra không nằm trên đường cong ed25519 (vì nếu không, ai đó có thể tìm thấy khóa bí mật của nó). Tuy nhiên, không phải mọi sự kết hợp seeds đều tạo ra một địa chỉ nằm ngoài đường cong hợp lệ.

Để khắc phục điều này, họ thêm một số nhỏ — bump (một số nguyên không dấu 8 bit từ 0–255) — số này được điều chỉnh tự động trong quá trình tạo PDA để đảm bảo một địa chỉ hợp lệ. Anchor tự động xử lý tính toán bump khi bạn khởi tạo PDA. Nhưng nếu chương trình của bạn cần tạo lại hoặc ký thay cho PDA đó, bạn phải lưu trữ bump để có thể tái tạo các hạt giống hoặc địa chỉ chính xác.

👉 Trong ví dụ của chúng ta, chúng ta lưu trữ bump trong `BankInfo` vì chương trình sẽ cần PDA Bank Vault để ký các chỉ dẫn sau này.

### 2. Khởi tạo một PDA
Bây giờ chúng ta đã hiểu PDA là gì, hãy cùng tìm hiểu cách tạo và khởi tạo một PDA trong Anchor.  
Trong ứng dụng ngân hàng của chúng ta, chúng ta khởi tạo PDA `BankInfo` khi chương trình được thiết lập lần đầu tiên. Đây là giao diện của nó trong `instructions/initialize.rs`:
```rust
#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        seeds = [BANK_INFO_SEED],
        bump,
        payer = authority,
        space = 8 + std::mem::size_of::<BankInfo>(),
    )]
    pub bank_info: Box<Account<'info, BankInfo>>,
}
```

##### 🧪Hãy cùng phân tích:
- `init`: Tạo một tài khoản PDA mới. Bạn chỉ có thể khởi tạo một PDA một lần — nếu nó đã tồn tại, giao dịch sẽ thất bại và bị huỷ. Nếu bạn cần sử dụng lại cùng một địa chỉ PDA, trước tiên bạn sẽ phải đóng tài khoản hiện có.
- `seeds` = [...]: Đây là các giá trị được sử dụng để lấy địa chỉ PDA một cách có nguyên tắc. Bạn có thể bao gồm nhiều seed khác nhau tùy thuộc vào trường hợp sử dụng của mình. Trong ví dụ này, chúng ta đang khởi tạo một tài khoản trạng thái toàn cục duy nhất, vì vậy chúng ta chỉ sử dụng một seed: `BANK_INFO_SEED`.
- `bump`: Hướng dẫn Anchor tự động tính toán một giá trị bump hợp lệ cho sự kết hợp seed này.
- `payer`: Việc tạo một PDA đòi hỏi không gian lưu trữ, và trên Solana, việc lưu trữ đi kèm với chi phí thuê (rent). Trường payer chỉ định người ký nào sẽ trả chi phí tạo tài khoản — trong trường hợp này là `authority`.
- `space`: Cần phân bổ bao nhiêu không gian (byte) cho tài khoản. PDA càng cần nhiều không gian, người trả tiền càng phải trả nhiều chi phí.

Bank Vault được khởi tạo ngay sau tài khoản `BankInfo`, nhưng có một vài điểm khác biệt chính đáng lưu ý:
```rust
    #[account(
        init,
        seeds = [BANK_VAULT_SEED],
        bump,
        payer = authority,
        space = 0,
        owner = system_program::ID
    )]
    pub bank_vault: UncheckedAccount<'info>,
```
##### 🧩 Có gì khác biệt ở đây?
+ *Không lưu trữ dữ liệu*: Không giống như `BankInfo`, PDA này không lưu trữ bất kỳ dữ liệu nào — do đó `space = 0`, và chúng ta không định nghĩa một struct cho nó.
+ *Sở hữu bởi hệ thống*: Tài khoản được tạo với `owner = system_program::ID`, nghĩa là nó được sở hữu bởi System Program, không phải chương trình Anchor của bạn. Điều này nghe có vẻ bất thường lúc đầu, nhưng đó là có chủ đích.
+ *Tại sao lại tạo PDA này?*  
Vault này đóng vai trò là nơi giữ tiền tập trung cho toàn bộ hệ thống của bạn. Vì nó là một PDA được lấy ra bằng ID chương trình của bạn và một seeds đã biết, chương trình của bạn vẫn có thể ký thay cho nó và kiểm soát số dư SOL của nó.

**⚠️ Lưu ý quan trọng**: Lý do chúng ta sử dụng một PDA do System Program sở hữu là vì chỉ những tài khoản do System Program sở hữu mới có thể tham gia vào việc chuyển SOL gốc. Khi chuyển SOL bằng lệnh transfer, cả người gửi và người nhận đều phải là các tài khoản do hệ thống sở hữu. Đó là lý do tại sao chúng ta cấu trúc vault theo cách này — do chương trình kiểm soát mà người dùng có thể gửi tiền vào hoặc rút tiền ra. Chúng ta sẽ tìm hiểu sâu hơn về cách thức hoạt động của tính năng này khi chúng ta triển khai logic chuyển SOL thực tế trong phần tiếp theo.

Bây giờ cả hai PDA đã được tạo, hãy tiếp tục với hàm xử lý nơi chúng ta khởi tạo các trường của tài khoản `BankInfo` của mình:
```rust
pub fn process(ctx: Context<Initialize>) -> Result<()> {
    let bank_info = &mut ctx.accounts.bank_info;

    bank_info.authority = ctx.accounts.authority.key();
    bank_info.is_paused = false;
    bank_info.bump = ctx.bumps.bank_vault;

    msg!("Bank initialized!");
    Ok(())
}
```
Ở đây chúng ta đang:
- Lưu khóa công khai (public key) của authority
- Đặt is_paused thành false theo mặc định
- Lưu trữ giá trị bump để ký PDA và lấy lại địa chỉ trong tương lai

Đó là kết thúc cho lệnh `Initialize`.

Bây giờ, hãy cùng xem cách chúng ta tạo các tài khoản PDA dành riêng cho người dùng — cụ thể là `UserReserve` — được xử lý trong tệp `instructions/deposit.rs`:
```rust
#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(
        init_if_needed,
        seeds = [USER_RESERVE_SEED, user.key().as_ref()],
        bump,
        payer = user,
        space = 8 + std::mem::size_of::<UserReserve>(),
    )]
    pub user_reserve: Box<Account<'info, UserReserve>>,
}
```
Mới nhìn qua, cái này trông giống như cách chúng ta khởi tạo `BankInfo` đúng không? Nhưng có một số khác biệt chính:
- `init_if_needed`: thành phần này kiểm tra xem PDA đã tồn tại chưa. Nếu chưa, Anchor sẽ tự động tạo nó; nếu đã có, PDA hiện tại sẽ được tải để có thể chỉnh sửa. Điều này thật hoàn hảo cho một lệnh như `Deposit`, vốn có thể được gọi nhiều lần bởi cùng một người dùng - không cần phải viết thêm logic để kiểm tra xem tài khoản đã tồn tại hay chưa trước khi sử dụng.
- `seeds`: Lần này, chúng ta sử dụng hai seed - một seeds không đổi `USER_RESERVE_SEED` và public key của người dùng `user.key().as_ref()` (được chuyển thành `&[u8]`). Mô hình này đảm bảo rằng mỗi người dùng có một PDA duy nhất của riêng họ — vì vậy không có hai người dùng nào dùng chung một tài khoản UserReserve. Nó cũng có nghĩa là mỗi người dùng chỉ có thể có một PDA UserReserve được tạo theo cách này, giúp đảm bảo tính nhất quán và bảo mật.

Sau đó, chúng ta xử lý logic chuyển tiền (deposit) trong hàm `process` như thế này:
```rust
pub fn process(ctx: Context<Deposit>, deposit_amount: u64) -> Result<()> {
    if ctx.accounts.bank_info.is_paused {
        return Err(BankAppError::BankAppPaused.into());
    }

    let user_reserve = &mut ctx.accounts.user_reserve;

    sol_transfer_from_user(
        &ctx.accounts.user,
        ctx.accounts.bank_info.to_account_info(),
        &ctx.accounts.system_program,
        deposit_amount,
    )?;

    user_reserve.deposited_amount += deposit_amount;

    Ok(())
}
```

Trong hàm này, trước khi cho phép bất kỳ việc chuyển tiền nào, chương trình trước tiên sẽ kiểm tra trạng thái của `BankInfo`:
```rust
if ctx.accounts.bank_info.is_paused {
    return Err(BankAppError::BankAppPaused.into());
}
```
Nếu bank app đang tạm dừng (có thể do tình trạng khẩn cấp hoặc nâng cấp), giao dịch sẽ bị từ chối.

Sau đó, chúng ta chuyển SOL từ người dùng sang PDA `BankInfo` — nơi đóng vai trò như một kho lưu trữ toàn cục giữ tất cả số tiền đã gửi.  
Việc chuyển tiền thực tế được xử lý bằng một hàm hỗ trợ được định nghĩa trong `transfer_helper.rs`:
```rust
//  chuyển SOL từ người dùng
pub fn sol_transfer_from_user<'info>(
    signer: &Signer<'info>,
    destination: AccountInfo<'info>,
    system_program: &Program<'info, System>,
    amount: u64,
) -> Result<()> {
    let ix = transfer(signer.key, destination.key, amount);
    invoke(
        &ix,
        &[
            signer.to_account_info(),
            destination,
            system_program.to_account_info(),
        ],
    )?;
    Ok(())
}
```
Vì người dùng là người ký trong trường hợp này, chúng ta có thể chỉ cần sử dụng `invoke()` để thực hiện việc chuyển tiền.  
Sau này, khi chúng ta triển khai việc rút tiền, chương trình sẽ cần ký thay cho PDA Bank Vault — và đối với việc đó, chúng ta sẽ sử dụng `invoke_signed()`.

Cuối cùng, chúng ta cập nhật PDA UserReserve của người dùng để phản ánh số tiền gửi mới:
```rust
user_reserve.deposited_amount += deposit_amount;
```
Bây giờ bạn đã biết cách tạo, khởi tạo và tương tác với các PDA bên trong chương trình, hãy cùng chuyển sang phía client.  
➡️ Trong phần tiếp theo, chúng ta sẽ tìm hiểu cách lấy các địa chỉ PDA từ client Anchor TypeScript để có thể gọi các lệnh này một cách chính xác từ frontend hoặc các tập lệnh.

### 3. Lấy PDA phía Client
Để tương tác với smart contract của bạn từ frontend hoặc script (như gọi `initialize` hoặc `deposit`), bạn sẽ cần lấy chính xác các địa chỉ PDA mà smart contract cần. Anchor giúp việc này trở nên dễ dàng ở phía client TypeScript.

Hãy xem cách thực hiện bằng cách sử dụng chính logic mà chúng ta đã sử dụng trong smart contract.  
Các địa chỉ PDA được lấy bằng công thức sau:
```ts
PublicKey.findProgramAddressSync([SEEDS], PROGRAM_ID)
```
- `SEEDS` là một mảng các byte (Buffer) phải khớp chính xác với những gì smart contract sử dụng.
- `PROGRAM_ID` là ID chương trình đã triển khai của bạn.

Trong bank-app, chúng ta lấy ra hai PDA.  
Đây là cách chúng được định nghĩa trong `tests/bank-app.ts`:
```ts
const BANK_APP_ACCOUNTS = {
    bankInfo: PublicKey.findProgramAddressSync(
        [Buffer.from("BANK_INFO_SEED")],
        program.programId
    )[0],
    bankVault: PublicKey.findProgramAddressSync(
        [Buffer.from("BANK_VAULT_SEED")],
        program.programId
    )[0],
    userReserve: (pubkey: PublicKey) => PublicKey.findProgramAddressSync(
        [
            Buffer.from("USER_RESERVE_SEED"),
            pubkey.toBuffer()
        ],
    program.programId
    )[0],
  }
```
Lưu ý rằng `userReserve` là một hàm. Điều này cho phép bạn tạo động một PDA duy nhất cho mỗi người dùng dựa trên khóa công khai của họ.  
Bằng cách lấy PDA theo cách này, bạn đảm bảo client của mình luôn sử dụng đúng các tài khoản — chính xác như chương trình của bạn mong đợi.

### 4. Đến lúc Xây dựng 💪 (Đến lượt bạn!)
Bây giờ bạn đã hiểu cách tạo và sử dụng PDA, đã đến lúc bạn đưa nó vào thực tế.

🛠️ Nhiệm vụ của bạn: 
1. **Triển khai `sol_transfer_from_pda` trong `transfer_helper.rs`**  
Hàm này sẽ chuyển SOL từ một PDA (như BankInfo) trở lại người dùng.  
Vì PDA không thể tự ký tên, bạn sẽ cần sử dụng `invoke_signed()` và truyền vào các hạt giống người ký (`signers_seeds`) chính xác.

2. **Hoàn thành Lệnh rút tiền (Withdraw)**  
Cho phép người dùng rút số SOL đã gửi của họ từ vault (tức là từ PDA Bank Vault).  
Chúng tôi đã cung cấp các hạt giống PDA cho lệnh này — chỉ cần lắp chúng vào để sử dụng `invoke_signed()` một cách chính xác.

3. **Triển khai Lệnh tạm dừng (Pause)**  
Thêm logic để tạm dừng hoặc bỏ tạm dừng ứng dụng. Chỉ authority được xác định trong BankInfo mới có thể làm điều này.  
💡 Gợi ý: Sử dụng `#[account(address = ...)]` của Anchor để hạn chế quyền truy cập.

4. **Đừng quên viết các bài kiểm tra trong `bank-app.ts`**  
Tạo các bài kiểm tra cho các lệnh `Withdraw` và `Pause` mới của bạn.  
Hãy đảm bảo:
- Rút đúng số tiền và xác minh `UserReserve` đã được cập nhật.
- Kiểm tra việc tạm dừng và bỏ tạm dừng ứng dụng, đồng thời đảm bảo các việc gửi/rút tiền bị chặn khi tạm dừng.

Sau khi hoàn thành các nhiệm vụ này, bạn sẽ có kinh nghiệm thực tế trong việc quản lý thẩm quyền PDA, bảo mật các lệnh và ký tên thay cho PDA — những khối xây dựng thiết yếu cho bất kỳ nhà phát triển Solana nghiêm túc nào.

🚀 Hãy cùng bắt đầu xây dựng thôi!














