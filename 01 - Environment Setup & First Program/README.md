# Phần I - Thiết lập Môi trường và Program Đầu tiên

Trước khi viết hoặc triển khai các program trên Solana, chúng ta cần thiết lập một môi trường phát triển phù hợp. Phần này sẽ hướng dẫn bạn mọi thứ cần để bắt đầu, từ việc cài đặt các công cụ quan trọng đến việc tạo, triển khai và kiểm thử dự án Anchor đầu tiên.

### Trong phần này, bạn sẽ:

✅ Cài đặt Rust, ngôn ngữ lập trình được sử dụng để viết các program Solana  
✅ Cài đặt Solana CLI, cho phép bạn tương tác với blockchain Solana thông qua các câu lệnh từ terminal 
✅ Cài đặt Anchor framework, bộ công cụ phổ biến nhất để lập trình trên Solana  
✅ Triển khai program lên Devnet  
✅ Viết và chạy test bằng Anchor  
✅ Nâng cấp program sau khi thực hiện các thay đổi  
✅ Đóng program để thu hồi SOL bị khóa trong các tài khoản đệm (buffer accounts)  

Sau khi hoàn thành phần này, bạn sẽ có mọi thứ cần thiết để xây dựng, kiểm thử và triển khai các program Solana trên Devnet.

### CÂU LỆNH CÀI ĐẶT TẤT CẢ CÁC THƯ VIỆN

```
curl --proto '=https' --tlsv1.2 -sSfL https://solana-install.solana.workers.dev | bash
```

Cài đặt thành công sẽ trả về kết quả như sau:

```
Installed Versions:
Rust: rustc 1.91.0 
Solana CLI: solana-cli 2.3.13 (src:5466f459; feat:2142755730, client:Agave)
Anchor CLI: 0.32.1
Node.js: v24.10.0
Yarn: 1.22.22
```

Kiểm tra lại bằng câu lệnh:

```
rustc --version && solana --version && anchor --version && node --version && yarn --version
```

Lệnh này sẽ cài đặt PHIÊN BẢN MỚI NHẤT, không phải PHIÊN BẢN PHÙ HỢP NHẤT. Để cài đặt các phiên bản phù hợp, hãy dán và chạy các lệnh sau:

```bash
rustup default 1.89.0
agave-install init 2.3.0
avm use 0.31.1

```

### 1. Cài đặt Rust

Chạy lệnh sau để cài đặt Rust:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
```

Sau khi cài đặt, bạn sẽ cần tải lại các biến môi trường để bao gồm thư mục bin của Cargo
Chạy lệnh sau:

```bash
. "$HOME/.cargo/env"
```

Kiểm tra xem Rust đã được cài đặt thành công chưa:

```bash
rustc --version
```

Để đảm bảo tính tương thích với phiên bản ổn định của Anchor (sẽ được cài đặt trong phần tiếp theo), chúng ta nên đặt phiên bản Rust thành 1.89.0:

```bash
rustup default 1.89.0
```

### 2. Cài đặt Solana CLI

Để tương tác với blockchain Solana, bạn cần cài đặt CLI của Solana. Solana CLI cung cấp các lệnh để tạo ví, triển khai program và gửi giao dịch.

Chạy lệnh sau để cài đặt Solana CLI:

```bash
sh -c "$(curl -sSfL https://release.anza.xyz/v2.3.8/install)"
```

Sau khi cài đặt, hãy cập nhật môi trường của bạn để lệnh `solana` có thể sử dụng được:

```bash
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
```

Kiểm tra phiên bản để xác nhận mọi thứ đã được thiết lập chính xác:

```bash
solana --version
```

```
Bây giờ Solana CLI đã được cài đặt thành công, bạn có thể tạo ví đầu tiên của mình bằng lệnh:
```bash
solana-keygen new 
```

Bạn sẽ thấy kết quả như sau:

```bash
Wrote new keypair to /Users/mac/.config/solana/id.json
====================================================================
pubkey: F7j1mwrkEo2Ssysmmuv8cwy6WCwG9umyfCp8iXpQ9qi8
====================================================================
Save this seed phrase and your BIP39 passphrase to recover your new keypair:
cloud taxi flash truth rug pill bronze duck bread month patch behave
====================================================================
```

⚠️ Quan trọng: Lưu trữ seed phrases của bạn một cách an toàn. Bất kỳ ai có quyền truy cập vào nó đều có thể kiểm soát tài sản của bạn.

Sau đó chuyển URL RPC sang devnet và nhận một ít SOL cho phí giao dịch(gas):

```bash
solana config set -u https://api.devnet.solana.com 
solana airdrop 5
```

Để dễ dàng truy cập và tương tác với UI, bạn có thể nhập ví của mình vào [Ví Phantom](https://phantom.com/download)
Chạy:

```bash
cat $HOME/.config/solana/id.json
```

Lệnh này in ra một mảng các số như:

```bash
[25,250,185,230,65,229,210,243,20,209,26,80,240,226,48,97,145,15,119,43,132,245,62,210,12,180,144,72,190,100,81,104,10,241,215,149,189,41,158,148,184,110,49,69,150,197,128,112,249,223,130,24,115,123,92,77,83,180,100,176,19,136,114,173]
```

Nhập mảng này vào Ví Phantom và bật Chế độ Testnet:



### 3. Cài đặt Anchor CLI

Anchor là một framework để phát triển các program trên Solana. Anchor tận dụng các Rust macro để đơn giản hóa quá trình viết code.
Trình quản lý phiên bản Anchor (AVM) cho phép bạn cài đặt và quản lý các phiên bản Anchor khác nhau trên hệ thống của mình và dễ dàng cập nhật các phiên bản Anchor trong tương lai.

Cài đặt AVM bằng lệnh sau:

```bash
cargo install --git https://github.com/coral-xyz/anchor avm --force
```

Xác nhận rằng AVM đã được cài đặt thành công:

```bash
avm --version
```

Hầu hết các giao thức Solana lớn (tính đến ngày 14 tháng 5 năm 2025) - như Jito, Jupiter, Raydium, Orca,... - vẫn sử dụng Anchor 0.29.0 trong các program của họ. Tuy nhiên, phiên bản này đã cũ, chúng ta cần sử dụng v0.30 trở lên, phiên bản ổn định nhất là 0.31.1.

```bash
avm use 0.31.1
```

Kiểm tra phiên bản Anchor của bạn:

```bash
anchor --version
```

Chúc mừng! Bạn đã cài đặt thành công Anchor.
Bây giờ bạn có thể khởi tạo dự án Anchor đầu tiên của mình bằng cách chạy:

```bash
anchor init my-first-anchor-project
```

Sau khi hoàn tất, kết quả sẽ trông giống như sau:

```bash
yarn install v1.22.22
warning package.json: No license field
info No lockfile found.
warning No license field
[1/4] 🔍  Resolving packages...
warning mocha > glob@7.2.0: Glob versions prior to v9 are no longer supported
warning mocha > glob > inflight@1.0.6: This module is not supported, and leaks memory. Do not use it. Check out lru-cache if you want a good and tested way to coalesce async requests by a key value, which is much more comprehensive and powerful.
[2/4] 🚚  Fetching packages...
[3/4] 🔗  Linking dependencies...
warning "@coral-xyz/anchor > @solana/web3.js > @solana/codecs-numbers@2.1.1" has incorrect peer dependency "typescript@>=5.3.3".
warning "@coral-xyz/anchor > @solana/web3.js > @solana/codecs-numbers > @solana/errors@2.1.1" has incorrect peer dependency "typescript@>=5.3.3".
warning "@coral-xyz/anchor > @solana/web3.js > @solana/codecs-numbers > @solana/codecs-core@2.1.1" has incorrect peer dependency "typescript@>=5.3.3".
[4/4] 🔨  Building fresh packages...
success Saved lockfile.
✨  Done in 8.05s.
Initialized empty Git repository in /Users/mac/Desktop/Solana Tutorials/Big-O Coding/solana-tutorials/01 - Environment Setup/my-first-anchor-project/.git/
my-first-anchor-project initialized
```

Nếu sau các bước trên bạn gặp lỗi 

```bash
feature edition2024 is required
```

hãy chạy lệnh sau : 

```bash
cargo update -p blake3 --precise 1.7.0 
```

Bây giờ bạn đã sẵn sàng để bắt đầu xây dựng trên Solana với Anchor!

### 4. Triển khai

Sau khi dự án Anchor của bạn được khởi tạo, Anchor sẽ tạo ra một program ví dụ cơ bản để giúp bạn bắt đầu. Program mẫu này bao gồm một hàm initialize đơn giản và đã sẵn sàng để triển khai lên mạng Solana.`

Đây là code của program mặc định: 

```rust
use anchor_lang::prelude::*;

declare_id!("F6N2DHUh9szawNRDSvC7VMqVCjLxTCJd2GDsf5vXjjZS");

#[program]
pub mod my_first_anchor_project {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
```

Dòng đầu tiên bạn thấy là ID hay địa chỉ của program:

```rust
declare_id!("F6N2DHUh9szawNRDSvC7VMqVCjLxTCJd2GDsf5vXjjZS");
```

Đây là **program ID** (hay địa chỉ program) sẽ được sử dụng sau khi triển khai. ID thực tế được xác định bởi cặp khóa (keypair) nằm tại:

```
my-first-anchor-project/target/deploy/my_first_anchor_project-keypair.json
```

Program ID của bạn có thể sẽ khác với ID được hiển thị ở trên, và bạn có thể tạo một cặp khóa ngẫu nhiên mới(new keypair) nếu cần.

Tiếp theo, chúng ta có logic chính của program:

```rust
#[program]
pub mod my_first_anchor_project {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }
}
```

Nó định nghĩa một phương thức gọi là `initialize`, nó không chứa bất kỳ logic nào, nó sẽ trả về `Ok(())` khi được gọi.

Bây giờ, để triển khai program lên devnet, trước tiên bạn cần build nó.  
Chạy lệnh sau:

```bash
anchor build
```

Kết quả sẽ trông giống như thế này:

```bash
warning: unused variable: `ctx`
 --> programs/my-first-anchor-project/src/lib.rs:9:23
  |
9 |     pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
  |                       ^^^ help: if this is intentional, prefix it with an underscore: `_ctx`
  |
  = note: `#[warn(unused_variables)]` on by default

warning: `my-first-anchor-project` (lib) generated 1 warning (run `cargo fix --lib -p my-first-anchor-project` to apply 1 suggestion)
    Finished release [optimized] target(s) in 37.40s
```

Bạn có thể bỏ qua cảnh báo này vào lúc này.  
Sau khi build, bạn sẽ thấy một tệp `.so` được tạo tại:

```
my-first-anchor-project/target/deploy/my_first_anchor_project.so
```

Tệp `.so` này là phiên bản đã biên dịch của program và sẽ được sử dụng để triển khai lên Solana Devnet.  
Ngoài ra, IDL và TypeScript types cũng được tạo tại:

```
target/idl/my_first_anchor_project.json
target/types/my_first_anchor_project.ts
```

Chúng ta sẽ để các tệp này như hiện tại và quay lại kiểm tra chúng trong phần kiểm thử.

Bây giờ bạn đã sẵn sàng để deploy program! Chạy lệnh sau:

```bash
solana program deploy target/deploy/my_first_anchor_project.so --program-id target/deploy/my_first_anchor_project-keypair.json
```

Bạn sẽ thấy kết quả tương tự như thế này:

```bash
Program Id: F6N2DHUh9szawNRDSvC7VMqVCjLxTCJd2GDsf5vXjjZS
```

🎉 **Chúc mừng!** Bạn đã deploy thành công program đầu tiên của mình lên Devnet.

Bạn cũng có thể cấu hình `Anchor.toml` của mình để chỉ định cluster devnet:

```
cluster = "Devnet"
```

Sau đó, deploy bằng cách sử dụng Anchor CLI:

```bash
anchor deploy
```

Điều này thuận tiện cho việc phát triển và kiểm thử localnet và devnet, nhưng **không được khuyến nghị cho các đợt triển khai trên mainnet**.

---

##### ⚠️ Tại sao không nên sử dụng `anchor deploy` trên Mainnet?

Trên mainnet, `anchor deploy` thường có thể thất bại do các vấn đề về độ tin cậy của RPC. Thay vào đó, tốt hơn là sử dụng lệnh `solana program deploy` với một RPC endpoint cụ thể.

Ví dụ, sử dụng `--use-rpc` với một RPC endpoint chất lượng cao:

```bash
solana program deploy target/deploy/my_first_anchor_project.so --program-id target/deploy/my_first_anchor_project-keypair.json --use-rpc
```

### 5. Kiểm thử

Sau khi xây dựng program của bạn bằng Anchor, việc kiểm thử nó và đảm bảo nó hoạt động như mong đợi là rất quan trọng. Anchor giúp việc kiểm thử trở nên đơn giản bằng cách sử dụng TypeScript và Mocha.  
Hãy cùng tìm hiểu cách chạy một bài kiểm tra cơ bản bằng cách sử dụng hàm `initialize()` mà chúng ta đã tạo trong program.

Anchor tự động tạo một tệp kiểm thử khi bạn khởi tạo dự án của mình. Bạn có thể tìm thấy nó trong thư mục `tests/`.  
File: `tests/my-first-anchor-project.ts`  
Nội dung như sau:

```typescript
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { MyFirstAnchorProject } from "../target/types/my_first_anchor_project";

describe("my-first-anchor-project", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.MyFirstAnchorProject as Program<MyFirstAnchorProject>;

  it("Is initialized!", async () => {
    // Add your test here.
    const tx = await program.methods.initialize().rpc();
    console.log("Your transaction signature", tx);
  });
});
```

Hãy cùng xem qua file này.  
Đầu tiên, lưu ý rằng tệp TypeScript client được tạo bằng cách chạy `anchor build` trước đó đang được nhập vào tệp kiểm thử:

```typescript
import { MyFirstAnchorProject } from "../target/types/my_first_anchor_project";
```

Việc nhập (import) này cho phép mã kiểm thử của bạn hiểu cấu trúc program của bạn.

Tiếp theo, bài kiểm thử thiết lập provider Anchor bằng cách sử dụng cấu hình môi trường:

```typescript
anchor.setProvider(anchor.AnchorProvider.env());
```

Điều này đảm bảo rằng Anchor sẽ sử dụng RPC endpoint và các config mà bạn đã thiết lập trong `Anchor.toml`—ví dụ: kết nối với Devnet và sử dụng local keypair của bạn.

Cuối cùng, đây là bài kiểm thử thực sự cho program của bạn:

```typescript
  it("Is initialized!", async () => {
    // Add your test here.
    const tx = await program.methods.initialize().rpc();
    console.log("Your transaction signature", tx);
  });
```

Lệnh này gọi phương thức `initialize()` từ program của bạn. Hàm `.rpc()` sẽ gửi giao dịch đến Solana Devnet, đợi xác nhận và trả về một mã băm giao dịch (transaction hash).

Bây giờ bạn đã sẵn sàng để kiểm thử program, hãy sử dụng lệnh sau:

```bash
anchor run test
```

Bạn sẽ thấy kết quả như thế này trong terminal của mình:

```bash
  my-first-anchor-project
Your transaction signature 3zZYomyMUycq2ybS6ACPszaQ5kTP8ZGoqU6TCxssXc1cU8YfTMMyABnY4r5e5pyvpjwhixkwsUbMrDACGmqjekAJ
    ✔ Is initialized! (1362ms)


  1 passing (1s)
```

✅ Chúc mừng! Bài kiểm thử của bạn đã vượt qua và program của bạn đã được khởi tạo thành công.

Bạn thậm chí có thể sao chép mã băm giao dịch và xem nó trên [Solscan](https://solscan.io/tx/3zZYomyMUycq2ybS6ACPszaQ5kTP8ZGoqU6TCxssXc1cU8YfTMMyABnY4r5e5pyvpjwhixkwsUbMrDACGmqjekAJ?cluster=devnet) để thấy nó đang hoạt động.

### 6. Nâng cấp

Sau khi deploy program của mình, bạn có thể muốn thực hiện các thay đổi hoặc thêm các tính năng mới. Thay vì tạo một program mới từ đầu, Anchor cho phép bạn nâng cấp program hiện có của mình — miễn là bạn có quyền nâng cấp (upgrade authority).

Hãy cùng tìm hiểu cách nâng cấp program sau khi thay đổi một chút mã nguồn.

Trong hàm `initialize()` của bạn, hãy thêm một số bản ghi (logging) để xem cách `msg!()` hoạt động:

```rust
pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
    let name = "Kai";
    let age = 22;

    msg!("My name is {}", name);
    msg!("I'm {} years old", age);
    msg!("This is my first anchor project!");

    Ok(())
}
```

Những bản ghi này sẽ hiển thị trong kết quả giao dịch và cực kỳ hữu ích cho việc gỡ lỗi, kiểm tra program trong quá trình chạy. Bạn sẽ cần sử dụng `msg!()` thường xuyên khi xây dựng dự án.
Ngoài ra, những bản ghi này cũng có thể được ghi lại bởi hạ tầng back-end của bạn để lưu trữ thông tin quan trọng hoặc kích hoạt các logic off-chain dựa trên các sự kiện on-chain.

Nâng cấp program Anchor của bạn gần giống như deploy nó lần đầu tiên. Đơn giản chỉ cần build lại program đã cập nhật bằng Anchor CLI, sau đó deploy phiên bản mới bằng Solana CLI—giống như chúng ta đã làm trước đây!

Miễn là bạn có quyền nâng cấp, quá trình này diễn ra rất đơn giản.

Sau đó bạn sẽ thấy một lỗi như thế này:

```bash
================================================================================
Recover the intermediate account's ephemeral keypair file with
`solana-keygen recover` and the following 12-word seed phrase:
================================================================================
stereo chair because cigar taxi stem celery embrace render autumn question quote
================================================================================
To resume a deploy, pass the recovered keypair as the
[BUFFER_SIGNER] to `solana program deploy` or `solana program write-buffer'.
Or to recover the account's lamports, pass it as the
[BUFFER_ACCOUNT_ADDRESS] argument to `solana program close`.
================================================================================
Error: Deploying program failed: RPC response error -32002: Transaction simulation failed: Error processing Instruction 0: account data too small for instruction [3 log messages]
```

Lỗi này có nghĩa là tài khoản miễn thuê (rent-exempt account) được sử dụng để lưu trữ dữ liệu program của bạn không còn đủ dung lượng để chứa phiên bản mới của program. Ngay cả một bản nâng cấp nhỏ cũng có thể khiến file thực thi program của bạn tăng kích thước nhẹ, yêu cầu nhiều dung lượng lưu trữ hơn.

Nếu bạn chưa quen với cơ chế thuê (rent) của Solana, đừng lo lắng—đó là một khái niệm quan trọng đảm bảo chi phí lưu trữ được phân bổ công bằng trên blockchain Solana. Bạn có thể tìm hiểu thêm về nó tại đây:  
👉 [Cơ chế Thuê (Rent) trên Solana là gì và Cách tính toán](https://www.quicknode.com/guides/solana-development/getting-started/understanding-rent-on-solana)

Bây giờ câu hỏi là: **Chúng ta cần mở rộng thêm bao nhiêu dung lượng?**  
Tất nhiên, nếu bạn giàu có 😄, bạn có thể sử dụng nhiều dung lượng hơn mức cần thiết, nhưng hãy nhớ rằng dung lượng dư thừa sẽ tiêu tốn nhiều SOL hơn, vì tiền thuê dựa trên kích thước lưu trữ.

Vì vậy, việc biết chính xác yêu cầu về kích thước là rất quan trọng.

Đầu tiên, bạn có thể kiểm tra kích thước hiện tại của program đã triển khai bằng cách chạy:

```bash
solana program show <YOUR_PROGRAM_ID>
```

Bạn sẽ thấy kết quả tương tự như thế này:

```bash
Program Id: GDGNBNAhHGmMKcxVxXBTTJ8xytmdjNuFWsr2igqhck27
Owner: BPFLoaderUpgradeab1e11111111111111111111111
ProgramData Address: 3i6z1Wi9oFXEU2NdVVeNf89DdNKJdwhuHRcGb2MMdUT4
Authority: jixspQw81GQVo969PPNeK7WteDhvWVFWhcLfLoMiPo2
Last Deployed In Slot: 380934198
Data Length: 180408 (0x2c0b8) bytes
Balance: 1.25684376 SOL
```

Ở đây, độ dài dữ liệu hiện tại là 180.408 byte.

Tiếp theo, hãy tìm kích thước của tệp `.so` mới được xây dựng bởi Anchor:

```bash
stat -f%z target/deploy/my_first_anchor_project.so 
```

trong Linux là:

```bash
stat -c %s target/deploy/my_first_anchor_project.so 
```

Lệnh này sẽ trả về 181.272 byte. Điều đó có nghĩa là phiên bản mới của program của bạn lớn hơn một chút. Vì vậy, bạn sẽ cần mở rộng không gian lưu trữ của program thêm `181272 - 180408 = 864` byte.

Bây giờ bạn có thể mở rộng không gian được phân bổ của program trước khi nâng cấp:

```bash
solana program extend <YOUR_PROGRAM_ID> 864
```

Và thế là xong! 

Bây giờ bạn đã sẵn sàng nâng cấp program, hãy chạy lại lệnh triển khai.
Nếu mọi thứ diễn ra suôn sẻ, program của bạn bây giờ đã được nâng cấp thành công!

Để xác minh rằng phiên bản mới đang hoạt động, hãy chạy lại bài kiểm tra của bạn: `anchor run test`  
Bạn sẽ thấy kết quả tương tự như:

```bash
  my-first-anchor-project
Your transaction signature 3frEHEMbWFwvWmq8GgM1H9zvHiaRwPY1296GHCoKasYC1zzHfLbjfALDQVojdPGDBNESLNenemmh5EComAt97BvG
    ✔ Is initialized! (1525ms)

  1 passing (2s)
```

Điều này xác nhận rằng quá trình nâng cấp của bạn đã thành công và mã mới, bao gồm cả hàm `initialize()` đã cập nhật của bạn, đang chạy bình thường.  
Nếu bạn muốn xem lại kết quả log, bạn có thể kiểm tra giao dịch trên [Solscan](https://solscan.io/3frEHEMbWFwvWmq8GgM1H9zvHiaRwPY1296GHCoKasYC1zzHfLbjfALDQVojdPGDBNESLNenemmh5EComAt97BvG?cluster=devnet)

### 7. Đóng

Tại một thời điểm nào đó, bạn có thể muốn ngừng sử dụng một program đã triển khai, đặc biệt là khi đang xây dựng hệ thống. Solana cho phép bạn đóng một program và thu hồi lượng SOL được sử dụng cho việc lưu trữ/thuê dữ liệu. Điều này hữu ích khi:

- Bạn đã hoàn thành việc kiểm thử và không còn cần program đó nữa.
- Bạn muốn triển khai lại từ đầu.
- Bạn đang quản lý việc lưu trữ on-chain và chi phí.

Khi bạn đóng một program, lượng lamports được giữ bởi tài khoản dữ liệu program sẽ được trả lại cho người nhận mà bạn chọn (thường là ví của bạn), và program sẽ không còn khả năng thực thi. Điều quan trọng cần lưu ý là:

- Chỉ có **upgrade authority** mới có thể đóng một program.
- Sau khi đóng, program **không thể được thực thi hoặc nâng cấp lại nữa**. Điều này có nghĩa là bạn không thể sử dụng lại cùng một on-chain Program ID. Nếu bạn muốn triển khai program đó một lần nữa, bạn sẽ phải tạo một cặp khóa mới và triển khai nó dưới một Program ID mới.

Còn nhớ thông báo cảnh báo này chứ? 👇

```bash
================================================================================
Recover the intermediate account's ephemeral keypair file with
`solana-keygen recover` and the following 12-word seed phrase:
================================================================================
stereo chair because cigar taxi stem celery embrace render autumn question quote
================================================================================
To resume a deploy, pass the recovered keypair as the
[BUFFER_SIGNER] to `solana program deploy` or `solana program write-buffer'.
Or to recover the account's lamports, pass it as the
[BUFFER_ACCOUNT_ADDRESS] argument to `solana program close`.
================================================================================
Error: Deploying program failed: RPC response error -32002: Transaction simulation failed: Error processing Instruction 0: account data too small for instruction [3 log messages]
```

Trong Phần 6 (Nâng cấp), chúng ta đã gặp vấn đề này khi triển khai phiên bản mới của program. Mặc dù chúng ta đã khắc phục vấn đề gốc rễ, SOL đã được chuyển sang một tài khoản đệm tạm thời—và nếu bạn không đóng nó thủ công, lượng SOL đó sẽ nằm ở đó mãi mãi.

Đây không phải là vấn đề lớn trên Devnet, nơi bạn chỉ cần chạy `solana airdrop 5` để lấy thêm SOL (mặc dù có giới hạn lượng nhận được trong ngày 🐢). Nhưng trên Mainnet, đây là tiền thật! Tính đến tháng 2 năm 2026, 1 SOL trị giá khoảng $80.

Vì vậy, để thu hồi SOL, bạn có thể đóng các program đã deploy và thu hồi SOL của mình:

```bash
solana program close <YOUR_PROGRAM_ID>
```

Bạn có thể xác minh lại số dư ví của mình bằng cách chạy:

```bash
solana balance
```

Và thế là xong, bạn đã dọn dẹp và thu hồi SOL của mình thành công! 🧹💰

