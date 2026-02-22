# Phần II - Triển khai, Kiểm tra, Nâng cấp và Đóng Smart Contract
Trong phần trước, chúng ta đã khởi tạo dự án my-first-anchor-project. Bây giờ, chúng ta sẽ tiến xa hơn một bước bằng cách tìm hiểu :

✅ Triển khai chương trình lên Devnet  
✅ Viết và chạy test bằng Anchor  
✅ Nâng cấp chương trình sau khi thay đổi  
✅ Và cuối cùng, đóng chương trình để thu hồi SOL nào bị khóa trong các tài khoản đệm (buffer accounts)  

Bắt đầu!

### 1. Triển khai

Sau khi dự án Anchor của bạn được khởi tạo, Anchor sẽ tạo ra một smart contract ví dụ cơ bản để giúp bạn bắt đầu. Smart contract mẫu này bao gồm một hàm initialize đơn giản và đã sẵn sàng để triển khai lên mạng Solana.`

Đây là code của smart contract mặc định: 
```rust
use anchor_lang::prelude::*;

declare_id!("2VCJobu63BfwAz1YNFY76tjWCHJubQGa9Qysc5fQmPP8");

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

Dòng đầu tiên bạn thấy là ID hay địa chỉ của smart contract:
```rust
declare_id!("2VCJobu63BfwAz1YNFY76tjWCHJubQGa9Qysc5fQmPP8");
```

Đây là **program ID** (hay địa chỉ smart contract) sẽ được sử dụng sau khi triển khai. ID thực tế được xác định bởi cặp khóa (keypair) nằm tại:
```
my-first-anchor-project/target/deploy/my_first_anchor_project-keypair.json
```
Program ID của bạn có thể sẽ khác với ID được hiển thị ở trên, và bạn có thể tạo một cặp khóa ngẫu nhiên mới(new keypair) nếu cần.

Tiếp theo, chúng ta có logic chính của smart contract:
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

Bây giờ, để triển khai chương trình lên devnet, trước tiên bạn cần build nó.  
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

Tệp `.so` này là phiên bản đã biên dịch của chương trình và sẽ được sử dụng để triển khai lên Solana Devnet.  
Ngoài ra, IDL và các kiểu dữ liệu TypeScript cũng được tạo tại:
```
target/idl/my_first_anchor_project.json
target/types/my_first_anchor_project.ts
```
Chúng ta sẽ để các tệp này như hiện tại và quay lại kiểm tra chúng trong phần kiểm thử.

Bây giờ bạn đã sẵn sàng để deploy smart contract! Chạy lệnh sau:
```bash
solana program deploy target/deploy/my_first_anchor_project.so --program-id target/deploy/my_first_anchor_project-keypair.json
```

Bạn sẽ thấy kết quả tương tự như thế này:
```bash
Program Id: 2VCJobu63BfwAz1YNFY76tjWCHJubQGa9Qysc5fQmPP8
```

🎉 **Chúc mừng!** Bạn đã deploy thành công smart contract đầu tiên của mình lên Devnet.

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

### 2. Kiểm thử
Sau khi xây dựng smart contract của bạn bằng Anchor, việc kiểm thử nó và đảm bảo nó hoạt động như mong đợi là rất quan trọng. Anchor giúp việc kiểm thử trở nên đơn giản bằng cách sử dụng TypeScript và Mocha.  
Hãy cùng tìm hiểu cách chạy một bài kiểm tra cơ bản bằng cách sử dụng hàm `initialize()` mà chúng ta đã tạo trong smart contract.

Anchor tự động tạo một tệp kiểm thử khi bạn khởi tạo dự án của mình. Bạn có thể tìm thấy nó trong thư mục `tests/`.  
Tệp: `tests/my-first-anchor-project.ts`  
Đây là giao diện của nó:

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

Hãy cùng xem tệp này.  
Đầu tiên, lưu ý rằng tệp TypeScript client được tạo bằng cách chạy `anchor build` trước đó đang được nhập vào tệp kiểm thử:
```typescript
import { MyFirstAnchorProject } from "../target/types/my_first_anchor_project";
```
Việc nhập (import) này cho phép mã kiểm thử của bạn hiểu cấu trúc smart contract của bạn.

Tiếp theo, bài kiểm thử thiết lập provider Anchor bằng cách sử dụng cấu hình môi trường:
```typescript
anchor.setProvider(anchor.AnchorProvider.env());
```
Điều này nói với Anchor sử dụng RPC endpoint và các config mà bạn đã thiết lập trong `Anchor.toml`—ví dụ: kết nối với Devnet và sử dụng local keypair của bạn.

Cuối cùng, đây là bài kiểm thử thực sự cho smart contract của bạn:
```typescript
  it("Is initialized!", async () => {
    // Add your test here.
    const tx = await program.methods.initialize().rpc();
    console.log("Your transaction signature", tx);
  });
```
Lệnh này gọi phương thức `initialize()` từ smart contract của bạn. Hàm `.rpc()` sẽ gửi giao dịch đến Solana Devnet, đợi xác nhận và trả về một mã băm giao dịch (transaction hash).

Bây giờ bạn đã sẵn sàng để kiểm tra smart contract, hãy sử dụng lệnh này để chạy kiểm tra:
```bash
anchor run test
```

Bạn sẽ thấy kết quả như thế này trong terminal của mình:
```bash
  my-first-anchor-project
Your transaction signature 3iFa2ASp4mcivVr2RjiqvUeVDwe1vcasp31A9vxperVRvPttcod9DqLyaY8kWu5d5owS6QuoJw5zfFDpBvb1jFqU
    ✔ Is initialized! (1362ms)


  1 passing (1s)
```

✅ Chúc mừng! Bài kiểm tra của bạn đã vượt qua và smart contract của bạn đã được khởi tạo thành công.

Bạn thậm chí có thể sao chép mã băm giao dịch và xem nó trên [Solscan](https://solscan.io/tx/3iFa2ASp4mcivVr2RjiqvUeVDwe1vcasp31A9vxperVRvPttcod9DqLyaY8kWu5d5owS6QuoJw5zfFDpBvb1jFqU?cluster=devnet) để thấy nó đang hoạt động.

### 3. Nâng cấp

Sau khi deploy smart contract của mình, bạn có thể muốn thực hiện các thay đổi hoặc thêm các tính năng mới. Thay vì tạo một smart contract mới từ đầu, Anchor cho phép bạn nâng cấp smart contract hiện có của mình — miễn là bạn có quyền nâng cấp (upgrade authority).

Hãy cùng tìm hiểu cách nâng cấp smart contract sau khi thay đổi một chút mã nguồn.

Trong hàm `initialize()` của bạn, hãy thêm một số bản ghi (logging) để xem cách `msg!()` hoạt động:
```rust
pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
    let name = "Nhat";
    let age = 23;

    msg!("My name is {}", name);
    msg!("I'm {} years old", age);
    msg!("This is my first anchor project!");

    Ok(())
}
```
Những bản ghi này sẽ hiển thị trong kết quả giao dịch và cực kỳ hữu ích cho việc gỡ lỗi, kiểm tra smart contract trong quá trình chạy. Bạn sẽ cần sử dụng `msg!()` thường xuyên khi xây dựng dự án.
Ngoài ra, những bản ghi này cũng có thể được ghi lại bởi hạ tầng back-end của bạn để lưu trữ thông tin quan trọng hoặc kích hoạt các logic off-chain dựa trên các sự kiện on-chain.

Bây giờ, hãy cùng tóm tắt nhanh những gì bạn đã học ở Phần 1 😄  
Nâng cấp smart contract Anchor của bạn gần giống như deploy nó lần đầu tiên. Đơn giản chỉ cần build lại smart contract đã cập nhật bằng Anchor CLI, sau đó deploy phiên bản mới bằng Solana CLI—giống như chúng ta đã làm trước đây!

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

Lỗi này có nghĩa là tài khoản miễn thuê (rent-exempt account) được sử dụng để lưu trữ dữ liệu smart contract của bạn không còn đủ dung lượng để chứa phiên bản mới của smart contract. Ngay cả một bản nâng cấp nhỏ cũng có thể khiến tệp thực thi smart contract của bạn tăng kích thước nhẹ, yêu cầu nhiều dung lượng lưu trữ hơn.

Nếu bạn chưa quen với cơ chế thuê (rent) của Solana, đừng lo lắng—đó là một khái niệm quan trọng đảm bảo chi phí lưu trữ được phân bổ công bằng trên blockchain Solana. Bạn có thể tìm hiểu thêm về nó tại đây:  
👉 [Cơ chế Thuê (Rent) trên Solana là gì và Cách tính toán](https://www.quicknode.com/guides/solana-development/getting-started/understanding-rent-on-solana)

Bây giờ câu hỏi là: **Chúng ta cần mở rộng thêm bao nhiêu dung lượng?**  
Tất nhiên, nếu bạn giàu có 😄, bạn có thể sử dụng nhiều dung lượng hơn mức cần thiết, nhưng hãy nhớ rằng dung lượng dư thừa sẽ tiêu tốn nhiều SOL hơn, vì tiền thuê dựa trên kích thước lưu trữ.

Vì vậy, việc biết chính xác yêu cầu về kích thước là rất quan trọng.

Đầu tiên, bạn có thể kiểm tra kích thước hiện tại của chương trình đã triển khai bằng cách chạy:
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

Lệnh này sẽ trả về 181.272 byte. Điều đó có nghĩa là phiên bản mới của smart contract của bạn lớn hơn một chút. Vì vậy, bạn sẽ cần mở rộng không gian lưu trữ của smart contract thêm `181272 - 180408 = 864` byte.

Bây giờ bạn có thể mở rộng không gian được phân bổ của smart contract trước khi nâng cấp:
```bash
solana program extend <YOUR_PROGRAM_ID> 864
```
Và thế là xong!

Bây giờ bạn đã sẵn sàng nâng cấp smart contract, hãy chạy lại lệnh triển khai.
Nếu mọi thứ diễn ra suôn sẻ, smart contract của bạn bây giờ đã được nâng cấp thành công!

Để xác minh rằng phiên bản mới đang hoạt động, hãy chạy lại bài kiểm tra của bạn: `anchor run test`  
Bạn sẽ thấy kết quả tương tự như:
```bash
  my-first-anchor-project
Your transaction signature hnN1ePkVLiKTQ1XT1NZbMyZZhzMnSEpUBiojSN2NVEDiUAdCQQkwbWDYDm74aWksUD7wMqo9EufFfwDw92PPenx
    ✔ Is initialized! (1525ms)


  1 passing (2s)
```

Điều này xác nhận rằng quá trình nâng cấp của bạn đã thành công và mã mới, bao gồm cả hàm `initialize()` đã cập nhật của bạn, đang chạy bình thường.  
Nếu bạn muốn xem lại kết quả nhật ký, bạn có thể kiểm tra giao dịch trên [Solscan](https://solscan.io/txhnN1ePkVLiKTQ1XT1NZbMyZZhzMnSEpUBiojSN2NVEDiUAdCQQkwbWDYDm74aWksUD7wMqo9EufFfwDw92PPenx?cluster=devnet)

<img src="../Example Images/02-UpgradeProgramLog.png" alt="upgrade program log" width="1000" height="300">

### 4. Đóng

Tại một thời điểm nào đó, bạn có thể muốn ngừng sử dụng một smart contract đã triển khai, đặc biệt là khi đang xây dựng hệ thống. Solana cho phép bạn đóng một smart contract và thu hồi lượng SOL được sử dụng cho việc lưu trữ/thuê dữ liệu. Điều này hữu ích khi:

- Bạn đã hoàn thành việc kiểm thử và không còn cần smart contract đó nữa.
- Bạn muốn triển khai lại từ đầu.
- Bạn đang quản lý việc lưu trữ on-chain và chi phí.

Khi bạn đóng một smart contract, lượng lamports được giữ bởi tài khoản dữ liệu smart contract sẽ được trả lại cho người nhận mà bạn chọn (thường là ví của bạn), và smart contract sẽ không còn khả năng thực thi. Điều quan trọng cần lưu ý là:

- Chỉ có **upgrade authority** mới có thể đóng một chương trình.
- Sau khi đóng, chương trình **không thể được thực thi hoặc nâng cấp lại nữa**. Điều này có nghĩa là bạn không thể sử dụng lại cùng một on-chain Program ID. Nếu bạn muốn triển khai chương trình đó một lần nữa, bạn sẽ phải tạo một cặp khóa mới và triển khai nó dưới một Program ID mới.

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

Trong Phần 3 (Nâng cấp), chúng ta đã gặp vấn đề này khi triển khai phiên bản mới của chương trình. Mặc dù chúng ta đã khắc phục vấn đề gốc rễ, SOL đã được chuyển sang một tài khoản đệm tạm thời—và nếu bạn không đóng nó thủ công, lượng SOL đó sẽ nằm ở đó mãi mãi.

Đây không phải là vấn đề lớn trên Devnet, nơi bạn chỉ cần chạy `solana airdrop 5` để lấy thêm SOL (mặc dù có giới hạn lượng nhận được trong ngày 🐢). Nhưng trên Mainnet, đây là tiền thật! Tính đến tháng 2 năm 2026, 1 SOL trị giá khoảng $80.

Vì vậy, để thu hồi SOL, trước tiên bạn cần khôi phục cặp khóa của bộ đệm bằng cách sử dụng seed phrases được hiển thị trong thông báo lỗi.
```bash
solana-keygen recover -o /path/buffer-keypair.json
```

Sau đó nhập seed phrases.

Bạn sẽ thấy:
```bash
[recover] seed phrase: 
[recover] If this seed phrase has an associated passphrase, enter it now. Otherwise, press ENTER to continue: 
Recovered pubkey `"HjbPTpkuANicPYtKE3WXfMARTQbqn5fsqx5Bmedr6vUt"`. Continue? (y/n): 
```

Bạn có thể chọn "y" để lưu tệp cặp khóa cho lần sử dụng sau, nhưng vì tôi đã có địa chỉ bộ đệm nên tôi sẽ chọn "n" và tiến hành đóng nó ngay lập tức.

Bây giờ bạn đã có địa chỉ tài khoản đệm, bạn có thể đóng nó và thu hồi SOL của mình:
```bash
solana program close <YOUR_BUFFER_ADDRESS>
```

Bạn sẽ thấy xác nhận như thế này:
```bash
Buffer Address                               | Authority                                    | Balance
HjbPTpkuANicPYtKE3WXfMARTQbqn5fsqx5Bmedr6vUt | jixspQw81GQVo969PPNeK7WteDhvWVFWhcLfLoMiPo2  | 1.2628572 SOL
```

Bạn có thể xác minh lại số dư ví của mình bằng cách chạy:
```bash
solana balance
```
Và thế là xong, bạn đã dọn dẹp và thu hồi SOL của mình thành công! 🧹💰








