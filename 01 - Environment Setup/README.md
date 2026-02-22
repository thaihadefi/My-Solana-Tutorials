# Phần I - Thiết lập Môi trường
Trước khi viết hoặc triển khai các smart contract trên Solana, chúng ta cần thiết lập một môi trường phát triển phù hợp. Phần này sẽ hướng dẫn bạn mọi thứ cần để bắt đầu, từ việc cài đặt các công cụ quan trọng đến việc tạo dự án Anchor đầu tiên.

### Trong phần này, bạn sẽ:
✅ Cài đặt Rust, ngôn ngữ lập trình được sử dụng để viết các chương trình Solana  
✅ Cài đặt Solana CLI, cho phép bạn tương tác với blockchain Solana thông qua các câu lệnh từ terminal 
✅ Cài đặt Anchor, bộ công cụ phổ biến nhất để phát triển Solana  

Đến cuối phần này, bạn sẽ có mọi thứ cần thiết để xây dựng, kiểm tra và triển khai các smart contract Solana trên Devnet.

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
rustup default 1.90.0
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

Để đảm bảo tính tương thích với phiên bản ổn định của Anchor (sẽ được cài đặt trong phần tiếp theo), chúng ta nên đặt phiên bản Rust thành 1.90.0:
```bash
rustup default 1.90.0
```

### 2. Cài đặt Solana CLI 

Để tương tác với blockchain Solana, bạn cần cài đặt CLI của Solana. Solana CLI cung cấp các lệnh để tạo ví, triển khai smart contract và gửi giao dịch.

Chạy lệnh sau để tải xuống và cài đặt Solana CLI:
```bash
sh -c "$(curl -sSfL https://release.anza.xyz/v2.3.0/install)"
```

Sau khi cài đặt, hãy cập nhật môi trường của bạn để lệnh `solana` có sẵn:
```bash
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
```

Kiểm tra phiên bản để xác nhận mọi thứ đã được thiết lập chính xác:
```bash
solana --version
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
<p float="left">
  <img src="../Example Images/01-ImportPhantom1.png" alt="Bước 1" width="240" height="400" style="margin-right: 10px;"/>
  <img src="../Example Images/01-ImportPhantom2.png" alt="Bước 2" width="240" height="400" style="margin-right: 10px;"/>
  <img src="../Example Images/01-ImportPhantom3.png" alt="Bước 3" width="240" height="400" style="margin-right: 10px;"/>
  <img src="../Example Images/01-ImportPhantom4.png" alt="Bước 4" width="240" height="400"/>
</p>

### 3. Cài đặt Anchor CLI

Anchor là bộ khung để phát triển các smart contract trên Solana. Anchor tận dụng các Rust macro để đơn giản hóa quá trình viết các smart contract trên Solana.
Trình quản lý phiên bản Anchor (AVM) cho phép bạn cài đặt và quản lý các phiên bản Anchor khác nhau trên hệ thống của mình và dễ dàng cập nhật các phiên bản Anchor trong tương lai.

Cài đặt AVM bằng lệnh sau:
```bash
cargo install --git https://github.com/coral-xyz/anchor avm --force
```

Xác nhận rằng AVM đã được cài đặt thành công:
```bash
avm --version
```

Hầu hết các giao thức Solana lớn (tính đến ngày 14 tháng 5 năm 2025) - như Jito, Jupiter, Raydium, Orca,... - vẫn sử dụng Anchor 0.29.0 trong các smart contract của họ. Tuy nhiên, phiên bản này đã cũ, chúng ta cần sử dụng v0.30 trở lên, phiên bản phù hợp nhất là 0.31.1.
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
Bây giờ bạn đã sẵn sàng để bắt đầu xây dựng trên Solana với Anchor!

# LƯU Ý : Bạn nên sử dụng các hệ điều hành sau để lập trình smart contract trên Solana
## WSL2 (WSL) trên Windows  
## Ubuntu
## MacOS





