# Phần Năm - Gọi chương trình Chéo (CPI)
Bây giờ bạn đã biết cách làm việc với token và ATA, đã đến lúc khám phá một trong những tính năng mạnh mẽ nhất của các hợp đồng thông minh Solana — Gọi Chương trình Chéo (Cross-Program Invocations - CPIs).

CPI cho phép một chương trình gọi và thực thi các chỉ dẫn trong một chương trình khác một cách an toàn. Đây là cách các ứng dụng DeFi tích hợp với các chương trình token, các oracle, các kho lưu trữ (staking vaults), và nhiều hơn nữa — cho phép các ứng dụng có tính mô-đun, có khả năng kết hợp trên khắp hệ sinh thái Solana.

Trong phần này, bạn sẽ:  
✅ Hiểu CPI là gì và cách nó hoạt động bên dưới lớp vỏ của Anchor  
✅ Đi qua một ví dụ: staking SOL từ Ứng dụng Ngân hàng bằng CPI  
✅ Xây dựng một Ứng dụng Staking spl-token đơn giản và tích hợp nó với Ứng dụng Ngân hàng bằng CPI  

Đến cuối phần này, bạn sẽ có thể tương tác với các chương trình bên ngoài và xây dựng các giao thức có thể kết hợp với phần còn lại của hệ sinh thái Solana — một siêu năng lực then chốt cho việc phát triển Solana nghiêm túc.

Bắt đầu thôi! 🔄💡

### 🏦 Mở rộng Ứng dụng Ngân hàng: Đầu tư thông qua CPI
Bạn đã biết rằng trong thế giới thực, các ngân hàng không chỉ giữ tiền gửi của người dùng — họ đưa số tiền đó vào hoạt động, đầu tư để thu lợi nhuận. Ứng dụng Ngân hàng của chúng ta cũng sắp làm điều tương tự.

Trong phiên này, chúng ta sẽ nâng cấp Ứng dụng Ngân hàng với khả năng đầu tư tiền của người dùng vào các giao thức bên ngoài bằng cách sử dụng Gọi Chương trình Chéo (CPI). Đây là cách các kho lưu trữ DeFi thực tế, các nền tảng cho vay và các DAO tăng trưởng vốn trong khi vẫn giữ mọi thứ on-chain và có thể kiểm toán.

Chúng ta sẽ hỗ trợ hai chức năng mới cho phép thẩm quyền Ngân hàng quản lý các khoản đầu tư:
+ Cho phép thẩm quyền ngân hàng đầu tư SOL từ kho lưu trữ của ngân hàng vào một dApp khác
+ Cho phép thẩm quyền ngân hàng rút số SOL đã đầu tư trước đó từ dApp trở lại kho lưu trữ

💡 Mô hình này tạo nền tảng cho các chiến lược sinh lời (yield strategies), các kho lưu trữ tự động và các hệ thống quản lý ngân quỹ trong Solana DeFi.

### 1. CPI là gì?
CPI, hay Cross-Program Invocation, là một tính năng trong Solana cho phép một chương trình gọi và thực thi các chỉ dẫn trong một chương trình khác — một cách an toàn và không cần xin phép.

Hãy nghĩ về nó giống như việc gọi một hàm từ một mô-đun khác — ngoại trừ cả hai "mô-đun" đều là các chương trình on-chain. Điều này cho phép khả năng kết hợp (composability), nghĩa là bạn có thể xây dựng các ứng dụng tái sử dụng logic từ các chương trình hiện có như Chương trình Token, các giao thức staking, thị trường cho vay, và nhiều hơn nữa.

#### 🧠 Tại sao CPI lại quan trọng?
✅ Khả năng tái sử dụng – Không cần phải phát minh lại bánh xe; chỉ cần gọi các chương trình hiện có.  
✅ Tính mô-đun – Xây dựng các ứng dụng sạch sẽ, dễ bảo trì bằng cách chia nhỏ logic qua các chương trình.  
✅ Khả năng tương tác – Chương trình của bạn có thể tương tác với các giao thức DeFi, DAO hoặc các ứng dụng tùy chỉnh khác.

#### 🧩 CPI hoạt động như thế nào?
Khi một chương trình muốn gọi một chương trình khác, nó thực hiện một lệnh Gọi Chương trình Chéo:
1. Nó chuẩn bị các tài khoản cần thiết và bất kỳ dữ liệu chỉ dẫn nào.
2. Nó đóng gói những thứ này vào một `CpiContext`, tùy chọn bao gồm các hạt giống người ký (signer seeds) nếu chương trình gọi đang sử dụng một PDA làm thẩm quyền.
3. Nó gọi hàm hỗ trợ CPI của chương trình mục tiêu. Anchor sẽ tự mã hóa và gửi chỉ dẫn CPI bằng Solana runtime.
4. Anchor xử lý việc xây dựng và gửi lệnh CPI bên dưới Solana runtime.

Trong mã nguồn Rust cấp thấp, việc này sẽ liên quan đến `invoke()` hoặc `invoke_signed()`, nhưng với Anchor, bạn thường không bao giờ cần gọi trực tiếp những hàm đó — Anchor sẽ xử lý việc đó cho bạn. Đây là một cách sạch sẽ, an toàn và thuận tiện để thực hiện các CPI trong Anchor.

Trong hướng dẫn này, **Ứng dụng Ngân hàng** của bạn sẽ gọi **Ứng dụng Staking** bằng CPI để stake hoặc rút SOL thay mặt cho người dùng. Đây chính xác là cách các giao thức DeFi thực tế như các kho lưu trữ sinh lời (yield vaults) hoạt động.

### 2. Ví dụ thực tế: Đầu tư SOL từ Ứng dụng Ngân hàng vào Ứng dụng Staking
Hãy xem CPI hoạt động như thế nào với một trường hợp sử dụng thực tế.  
Trong phần này, chúng ta sẽ nâng cấp Ứng dụng Ngân hàng để thẩm quyền ngân hàng có thể đầu tư SOL từ Kho lưu trữ Ngân hàng vào một Ứng dụng Staking bên ngoài — bằng cách sử dụng một lệnh gọi CPI. Điều này phản ánh cách các giao thức DeFi thực tế đưa vốn nhàn rỗi vào hoạt động để tạo ra lợi nhuận.

#### 🧱 Tổng quan về Ứng dụng Staking

Trước khi chúng ta thiết lập CPI, trước tiên hãy đi qua Ứng dụng Staking — một chương trình đơn giản cho phép người dùng (hoặc một chương trình khác) stake và rút SOL.

Đây là cách nó hoạt động:
+ Người dùng tương tác với một chỉ dẫn `Stake` duy nhất hỗ trợ cả staking và rút tiền (unstaking), tùy thuộc vào giá trị boolean `is_stake`.
+ Ứng dụng trả mức APR cố định là 5% cho những người stake.
+ Hợp đồng sử dụng các PDA để lưu trữ các tài khoản `UserInfo` nhằm theo dõi số dư stake.

📂 Bạn có thể tìm thấy mã nguồn trong `programs/staking-app`:
```rust
    pub fn stake(ctx: Context<Stake>, amount: u64, is_stake: bool) -> Result<()> {
        ...
    }

    #[derive(Accounts)]
    pub struct Stake<'info> {
        /// CHECK:
        #[account(
            init_if_needed,
            payer = payer,
            seeds = [b"STAKING_VAULT"],
            bump,
            space = 0,
            owner = system_program::ID
        )]
        pub staking_vault: UncheckedAccount<'info>,

        #[account(
            init_if_needed,
            seeds = [b"USER_INFO", user.key().as_ref()],
            bump,
            payer = payer,
            space = 8 + std::mem::size_of::<UserInfo>(),
        )]
        pub user_info: Box<Account<'info, UserInfo>>,

        #[account(mut)]
        pub user: Signer<'info>,
        #[account(mut)]
        pub payer: Signer<'info>,
        pub system_program: Program<'info, System>,
    }
```
> 📝 Lưu ý: Chỉ có một chỉ dẫn `Stake` được sử dụng cho cả staking và rút tiền — được điều khiển bởi cờ `is_stake`. Điều này giúp giữ cho mã nguồn gọn gàng (DRY), vì logic gần như giống hệt nhau cho cả hai hành động.

Lưu ý rằng có hai tài khoản người ký:
+ `user`: Chủ sở hữu hợp pháp của số tiền stake (đây sẽ là PDA Kho lưu trữ Ngân hàng của chúng ta)
+ `payer`: Người ký trả phí tạo tài khoản (phí thuê/rent fee)

Sự phân tách này hoàn hảo cho Ứng dụng Ngân hàng của chúng ta vì PDA Kho lưu trữ Ngân hàng (được sử dụng làm user) sẽ không phải trả phí thuê tài khoản và thẩm quyền ngân hàng (một người ký thực sự) có thể chi trả chi phí thuê trong quá trình CPI. Điều này làm cho việc tích hợp trở nên suôn sẻ — không cần phải cấp vốn trước cho kho lưu trữ bằng lamport chỉ để tạo một tài khoản thông tin người dùng mới.

#### 🚀 Sẵn sàng tích hợp
Với Ứng dụng Staking đã được triển khai trên devnet, không cần phải triển khai lại hoặc sửa đổi nó. Bạn chỉ cần tái sử dụng mã nguồn và tham chiếu cùng một ID chương trình khi thiết lập CPI từ Ứng dụng Ngân hàng.

Bây giờ chúng ta đã chọn ứng dụng đầu tư mục tiêu (Ứng dụng Staking), hãy tích hợp nó vào Ứng dụng Ngân hàng bằng cách sử dụng Gọi Chương trình Chéo (CPI).

Trước tiên, hãy thêm staking-app làm một dependency trong `Cargo.toml` của Ứng dụng Ngân hàng:
```toml
[dependencies]
...
staking-app = {  path = "../staking-app", features = ["cpi"] }
```
Điều này cấp cho Ứng dụng Ngân hàng quyền truy cập vào giao diện CPI của Ứng dụng Staking, cho phép chúng ta gọi chỉ dẫn stake của nó trực tiếp từ chương trình của mình.

#### 🧱 Cấu trúc lại nhỏ: Tổ chức các Chỉ dẫn theo Vai trò
Khi Ứng dụng Ngân hàng của chúng ta phát triển, đây là thời điểm tốt để sắp xếp lại một chút.  
Trong phần này, chúng ta sẽ cấu trúc lại dự án để tổ chức các chỉ dẫn tốt hơn dựa trên những ai được phép thực thi chúng:
+ `instructions/user/` — cho các chỉ dẫn mà người dùng thông thường có thể gọi (ví dụ: gửi tiền, rút tiền)
+ `instructions/authority/` — cho các chỉ dẫn có đặc quyền mà thẩm quyền ngân hàng có thể thực thi

Điều này làm cho cơ sở mã có khả năng mở rộng và dễ đọc hơn. Chỉ dẫn `invest` mới — nơi thẩm quyền ngân hàng thực hiện stake hoặc rút SOL — sẽ nằm trong:
```bash
instructions/authority/invest.rs
```

#### 🛠️ Viết Chỉ dẫn `invest`
Bây giờ Ứng dụng Ngân hàng của chúng ta đã sẵn sàng cho CPI, hãy triển khai chỉ dẫn `invest` thực tế, cho phép thẩm quyền Ngân hàng thực hiện stake hoặc rút SOL vào Ứng dụng Staking bên ngoài.
Đây là mã nguồn đầy đủ: 
```rust
#[derive(Accounts)]
pub struct Invest<'info> {
    #[account(
        seeds = [BANK_INFO_SEED],
        bump
    )]
    pub bank_info: Box<Account<'info, BankInfo>>,

    /// CHECK: Kho lưu trữ Ngân hàng (PDA) giữ các khoản tiền gửi SOL
    #[account(
        mut,
        seeds = [BANK_VAULT_SEED],
        bump,
        owner = system_program::ID
    )]
    pub bank_vault: UncheckedAccount<'info>,

    /// CHECK: Kho lưu trữ staking mục tiêu của CPI
    #[account(mut)]
    pub staking_vault: UncheckedAccount<'info>,

    /// CHECK: Thông tin staking người dùng mục tiêu của CPI (PDA)
    #[account(mut)]
    pub staking_info: UncheckedAccount<'info>,

    /// Chương trình Ứng dụng Staking để gọi thông qua CPI
    pub staking_program: Program<'info, StakingApp>,

    /// Thẩm quyền Ngân hàng — chỉ người ký này mới có thể đầu tư
    #[account(mut, address = bank_info.authority)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}
```
**👇 Hãy cùng phân tích một vài tài khoản chính liên quan đến CPI:**
+ `staking_vault`: Tài khoản kho lưu trữ do Ứng dụng Staking sở hữu. Đây là nơi SOL được lưu trữ sau khi đã stake.

+ `staking_info`: Đây là tài khoản siêu dữ liệu (metadata) staking của người dùng trong Ứng dụng Staking. Trong trường hợp của chúng ta, “người dùng” là PDA Kho lưu trữ Ngân hàng — vì vậy tài khoản này đóng vai trò như một bản ghi `UserInfo` gắn liền với kho lưu trữ của ngân hàng.

+ `staking_program`: Tham chiếu đến chính Ứng dụng Staking, để Ứng dụng Ngân hàng có thể thực hiện Gọi Chương trình Chéo (CPI).

#### 🧠 Bên trong Logic: `process()`
Đây là phần quan trọng nhất — chính là lệnh gọi CPI:
```rust
cpi::stake(
    CpiContext::new_with_signer(
        ctx.accounts.staking_program.to_account_info(),
        cpi::accounts::Stake {
            staking_vault: ctx.accounts.staking_vault.to_account_info(),
            user_info: ctx.accounts.staking_info.to_account_info(),
            user: ctx.accounts.bank_vault.to_account_info(),
            payer: ctx.accounts.authority.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
        },
        invest_vault_seeds,
    ),
    amount,
    is_stake,
)?;
```

##### `cpi::stake(...)`
Hàm này là một bản bọc (wrapper) được Anchor tạo ra cho phép bạn gọi một chỉ dẫn từ một chương trình khác (trong trường hợp này là Ứng dụng Staking):
- Tên hàm `stake` tương ứng với chỉ dẫn `stake` có thể truy cập qua CPI trong chương trình staking-app.
- Nó được nhập thông qua giao diện CPI nhờ vào việc thiết lập dependency trong `Cargo.toml`.
- Bên dưới, Anchor tạo ra một hàm ở đây để:
  1. Xây dựng chỉ dẫn.
  2. Chuẩn bị các siêu dữ liệu tài khoản (account metas).
  3. Sử dụng `invoke_signed` để thực hiện lệnh gọi CPI thực tế nếu các hạt giống người ký được cung cấp.

> ✅ Ý tưởng chính: Việc này trông giống như một lệnh gọi hàm Rust thông thường — nhưng thực tế nó đang thực thi một chương trình khác on-chain!

Khối nhỏ này là nơi diễn ra tương tác thực tế giữa các chương trình — chỉ với vài dòng mã, chúng ta có thể định tuyến tiền từ Ứng dụng Ngân hàng vào một chiến lược staking tạo ra lợi nhuận một cách an toàn và bảo mật.

##### `CpiContext::new_with_signer(...)`
Đây là cách bạn xây dựng ngữ cảnh thực thi cho một lệnh gọi CPI khi chương trình của bạn cần ký thay cho một PDA.

Các tham số:
+ `program`: AccountInfo của chương trình mục tiêu — trong trường hợp của chúng ta là staking_program.
+ `accounts`: Phiên bản tương thích với CPI của struct tài khoản mà chương trình mục tiêu mong đợi. Ở đây chúng ta đang sử dụng `cpi::accounts::Stake`, một struct khớp với struct đã được định nghĩa trong staking-app.
+ `signer_seeds`: Một tham chiếu đến các hạt giống PDA được sử dụng để lấy lại địa chỉ và ký thay cho PDA `bank_vault`.

##### `cpi::accounts::Stake`
Đây là phiên bản CPI của ngữ cảnh `Stake` được định nghĩa trong `staking-app`:
```rust
#[derive(Accounts)]
pub struct Stake<'info> {
    pub staking_vault: AccountInfo<'info>,
    pub user_info: AccountInfo<'info>,
    pub user: AccountInfo<'info>,
    pub payer: AccountInfo<'info>,
    pub system_program: AccountInfo<'info>,
}
```
> Anchor tự động tạo một mô-đun `cpi::accounts` cho mọi chương trình bạn nhập với `features = ["cpi"]`.  
Bạn có trách nhiệm tự tay kết nối các tài khoản phù hợp ở đây bằng cách sử dụng `.to_account_info()` từ ngữ cảnh của mình.

#### ✅ Tóm tắt
Khối mã này:
```rust
cpi::stake(CpiContext::new_with_signer(...), amount, is_stake)?;
```
là cách Ứng dụng Ngân hàng gọi vào Ứng dụng Staking một cách an toàn để stake hoặc rút SOL. Nó thực hiện:
+ Xây dựng một ngữ cảnh CPI (`CpiContext`)
+ Cung cấp các hạt giống người ký để PDA `bank_vault` có thể ủy quyền cho giao dịch
+ Truyền dữ liệu tài khoản có cấu trúc khớp với các đầu vào mong đợi của ứng dụng staking
+ Gọi chỉ dẫn `stake` trong chương trình khác — như thể nó là một phần của chương trình hiện tại  
Mô hình này minh chứng cho sức mạnh của khả năng kết hợp trên Solana — chương trình của bạn có thể gọi vào bất kỳ chương trình nào khác và xây dựng các logic phong phú, được kết nối với nhau.

#### 🧑‍💻 Bước tiếp theo
Vậy là bạn đã thấy một ví dụ thực tế về cách Ứng dụng Ngân hàng có thể đầu tư tiền gửi của người dùng vào một chương trình on-chain khác — Ứng dụng Staking — bằng cách sử dụng Gọi Chương trình Chéo (CPI). Điều này phản ánh cách các ngân hàng truyền thống đầu tư số vốn nhàn rỗi và cho thấy khả năng kết hợp của Solana mạnh mẽ như thế nào.

Bây giờ đến lượt bạn.

### 3. Bạn Xây dựng nó: Staking Token bằng CPI 💼
Bạn đã học được khái niệm về CPI và thấy nó hoạt động với staking SOL — bây giờ là lúc áp dụng kiến thức đó và tự mình xây dựng một thứ gì đó.

Trong phần này, bạn sẽ mở rộng Ứng dụng Ngân hàng để hỗ trợ các khoản đầu tư token SPL thông qua CPI. Mục tiêu là phản ánh cùng một quy trình staking mà bạn vừa học, nhưng với các token SPL thay vì SOL.

Điều này sẽ mang lại cho bạn kinh nghiệm thực tế trong việc viết các tích hợp CPI, quản lý các tài khoản token và xây dựng logic kiểu DeFi trên Solana.

🛠️ Nhiệm vụ của bạn: 
1. **Viết các bài kiểm tra cho Tích hợp CPI SOL hiện có**  
Chỉ dẫn `invest` đã được triển khai — nhiệm vụ đầu tiên của bạn là viết một bài kiểm tra để đảm bảo nó stake và rút SOL một cách chính xác qua Ứng dụng Staking.  
Hãy kiểm tra kỹ lưỡng cả quy trình stake và rút tiền.

2. **Xây dựng một Chương trình Staking dựa trên Token**  
Tạo một ứng dụng staking đơn giản mới hỗ trợ bất kỳ token SPL nào và cung cấp APR cố định 5%, tương tự như phiên bản staking SOL.
+ Hỗ trợ Stake và Unstake qua một chỉ dẫn duy nhất
+ Sử dụng các ATA và PDA đúng cách để lưu trữ token
+ Xử lý logic phần thưởng staking một cách sạch sẽ

3. **Mở rộng Ứng dụng Ngân hàng với Đầu tư Token**
Thêm một chỉ dẫn mới vào Ứng dụng Ngân hàng của bạn:
+ `InvestToken` — cho phép thẩm quyền ngân hàng đầu tư các token SPL đã gửi vào chương trình staking mới của bạn bằng cách sử dụng CPI
+ Việc này sẽ tương tự như chỉ dẫn `invest` mà bạn đã thấy, nhưng dành cho token thay vì SOL

4. **🧪 Viết các bài kiểm tra cho mọi thứ**
🔁 Và như mọi khi — đừng quên viết các bài kiểm tra cho:
+ Chương trình Staking Token SPL mới của bạn
+ Chỉ dẫn `InvestToken` trong Ứng dụng Ngân hàng

#### 🚀 Sẵn sàng Xây dựng?
Phần này tập trung hoàn toàn vào việc áp dụng những gì bạn đã học — kết hợp các PDA, ATA, CPI và việc kiểm tra để xây dựng một tính năng hoàn chỉnh từ đầu đến cuối.

Bạn hiện đang xây dựng các mô hình DeFi thực thụ — và những kỹ năng bạn đang sử dụng ở đây chính xác là những gì các giao thức sản phẩm thực tế trên Solana được xây dựng bằng.

Hãy xem bạn có thể tạo ra những gì. 💪🌐























