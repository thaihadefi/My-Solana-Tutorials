# Phần IX – Surfpool: Môi Trường Phát Triển Solana Thế Hệ Mới

Bạn đã đi qua toàn bộ hành trình từ transaction cơ bản, PDA, CPI, cho đến versioned transaction và IDL. Bài cuối này không phải về một tính năng on-chain mới — mà về **cách làm việc đúng hơn** trong toàn bộ vòng đời phát triển Solana.

Cho đến giờ bạn đang test trên `localnet` hoặc `devnet`. Cả hai đều có vấn đề. Bài này giải quyết điều đó.

---

Kết thúc bài học này, bạn sẽ:

- Hiểu tại sao `localnet` và `devnet` đều có giới hạn nghiêm trọng
- Biết Surfpool là gì và tại sao nó ra đời
- Biết cách dùng Surfnet để test với dữ liệu mainnet thật
- Biết cách dùng Cheatcodes để thao túng state khi test
- Hiểu Infrastructure as Code (IaC) là gì và tại sao quan trọng với production

---

## 1. Vấn Đề Với Môi Trường Test Hiện Tại

Trước khi hiểu Surfpool, hãy nhìn thẳng vào vấn đề của ba môi trường quen thuộc:

```
Localnet          Devnet            Mainnet
─────────         ──────────        ────────
✅ Nhanh          ✅ Gần mainnet    ✅ Thật 100%
✅ Kiểm soát      ⚠️  Không ổn định  ❌ Tốn SOL thật
❌ Không có       ❌ Token faucet    ❌ Rủi ro thật
   data thật         chậm, giới hạn
❌ Phải mock       ❌ Program bên    ❌ Không thể
   mọi thứ           thứ ba có thể     reset state
                     khác mainnet
```

**Tình huống thực tế gây đau đầu nhất:**

Bạn đang xây dựng một DeFi protocol tích hợp Jupiter để swap token. Trên localnet, Jupiter không tồn tại — bạn phải mock toàn bộ, tốn hàng giờ setup và kết quả test không phản ánh thực tế. Trên devnet, Jupiter có nhưng state khác mainnet, pool thanh khoản khác, giá khác. Trên mainnet thì bạn không dám test vì sợ mất tiền thật.

**Đây chính xác là vấn đề Surfpool ra đời để giải quyết.**

---

## 2. Surfpool là gì?



Surfpool là **drop-in replacement cho `solana-test-validator`** — tức là bạn dùng nó y hệt như validator cũ, không cần thay đổi workflow, không cần sửa `Anchor.toml`.

Điểm khác biệt cốt lõi: **Surfpool fork mainnet state theo kiểu lazy** — thay vì download toàn bộ blockchain (2TB+), nó chỉ tải data của account nào bạn thực sự dùng đến, ngay lúc cần.

```
solana-test-validator (cũ)       Surfpool / Surfnet (mới)
────────────────────────         ────────────────────────
Local state trống hoàn toàn      Fork mainnet state on-demand
Phải mock program bên thứ ba     Jupiter, Marinade... có sẵn
Không có token thật              Faucet bất kỳ token nào
Không thể time travel            Cheatcodes: warp slot, set balance
Setup phức tạp khi tích hợp CPI  Clone account/program 1 lệnh
```

> **Surfpool = Surfnet (local network) + Cheatcodes + IaC tooling**
>
> Surfnet là tên của local Solana network mà Surfpool tạo ra. Surfpool là toàn bộ bộ công cụ xung quanh nó.

---

## 3. Cài Đặt

```bash
# macOS / Linux
curl -fsSL https://docs.surfpool.run/install.sh | sh

# Kiểm tra
surfpool --version
```

Surfpool hoàn toàn tương thích với Solana CLI, Anchor, và mọi tool bạn đã dùng:

```bash
# Thay vì
solana-test-validator

# Dùng
surfpool start
```

Sau khi start, Surfnet chạy tại `http://127.0.0.1:8899` — cùng port với `solana-test-validator`. Không cần thay đổi bất kỳ config nào.

---

## 4. Surfnet: Fork Mainnet On-Demand

### Copy-on-Read Strategy

Đây là cơ chế cốt lõi của Surfnet. Khi transaction của bạn cần đọc một account:

```
Transaction cần đọc account Jupiter Pool
         ↓
Surfnet kiểm tra local cache
         ↓ (chưa có)
Fetch từ Mainnet RPC của bạn
         ↓
Cache lại locally
         ↓
Mọi write chỉ lưu locally, không ảnh hưởng mainnet
```

Kết quả: bạn có môi trường test với **data mainnet thật** nhưng hoàn toàn **isolated** — làm gì cũng được, reset bất cứ lúc nào.

### Dùng Với Anchor

```bash
# Trong thư mục Anchor project
surfpool start

# Anchor deploy như bình thường
anchor deploy --provider.cluster localnet

# Chạy test như bình thường
anchor test --skip-local-validator
```

Surfnet tự động phát hiện Anchor workspace và hỏi bạn có muốn dùng IaC không (sẽ nói ở phần sau).

### Kết Nối RPC Của Bạn

Để fetch mainnet data, Surfnet cần một RPC endpoint. Cấu hình trong `Surfpool.toml`:

```toml
[network]
rpc_url = "https://mainnet.helius-rpc.com/?api-key=YOUR_KEY"
# hoặc bất kỳ RPC nào: QuickNode, Alchemy, Triton...
```

---

## 5. Cheatcodes: Siêu Năng Lực Khi Test

Cheatcodes là các RPC method đặc biệt chỉ tồn tại trên Surfnet — không có trên mainnet hay devnet. Chúng cho phép bạn làm những việc không thể làm trên network thật.

### 5.1. Nạp Tiền Tức Thì — "The Heist"

Thay vì chờ faucet devnet (chậm, giới hạn, hay lỗi), Surfnet cho bạn nạp bất kỳ token nào tức thì:

```typescript
// Nạp 1000 USDC vào ví test của bạn
await connection.requestAirdrop(wallet.publicKey, LAMPORTS_PER_SOL * 10);

// Hoặc dùng surfnet_setTokenAccount để set số dư token bất kỳ
const response = await fetch("http://127.0.0.1:8899", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "surfnet_setTokenAccount",
    params: [
      wallet.publicKey.toString(),  // owner
      USDC_MINT.toString(),          // mint
      { amount: 1_000_000_000 },    // 1000 USDC (6 decimals)
    ],
  }),
});
```

Không cần faucet. Không cần swap. Không cần chờ. Muốn test với 1 triệu USDC? Một dòng lệnh.

### 5.2. Time Travel — Warp Slot

Nhiều Solana program có logic phụ thuộc vào thời gian: vesting schedule, staking cooldown, auction deadline... Test những tính năng này trên devnet rất khó vì bạn phải thực sự chờ.

Với Surfnet, bạn nhảy thẳng đến slot bất kỳ:

```typescript
// Warp đến slot trong tương lai (bỏ qua 10000 slot)
await connection.requestAirdrop(wallet.publicKey, 0); // dummy call để lấy current slot
// ...

// Dùng surfnet cheatcode để advance clock
const response = await fetch("http://127.0.0.1:8899", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "surfnet_setAccount",
    params: [
      SYSVAR_CLOCK_PUBKEY.toString(),
      { 
        data: serializeClockData({ 
          slot: currentSlot + 432000, // ~2 ngày sau
          unixTimestamp: Date.now() / 1000 + 172800 
        }) 
      }
    ],
  }),
});
```

### 5.3. Profile Transaction — Debug Compute Units

Một trong những tính năng mạnh nhất: profile chi tiết một transaction **trước khi gửi** lên network.

```typescript
// Serialize transaction
const serializedTx = Buffer.from(transaction.serialize()).toString("base64");

// Profile nó
const response = await fetch("http://127.0.0.1:8899", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "surfnet_profileTransaction",
    params: [
      serializedTx,
      "my-deposit-test",       // tag để group kết quả
      { depth: "instruction" } // breakdown theo từng instruction
    ],
  }),
});

const profile = response.value;
console.log("Compute units tiêu thụ:", profile.computeUnits.computeUnitsConsumed);
console.log("State trước:", profile.state.preExecution);
console.log("State sau:", profile.state.postExecution);
```

Bạn thấy được chính xác bao nhiêu compute unit mỗi instruction tốn, account nào thay đổi gì — cực kỳ hữu ích khi tối ưu program.

### 5.4. Set Account Data Thủ Công

Đôi khi bạn cần tạo một account với state đặc biệt để test edge case:

```typescript
// Tạo một account với data và lamport tùy ý
await fetch("http://127.0.0.1:8899", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "surfnet_setAccount",
    params: [
      targetPubkey.toString(),
      {
        lamports: 1_000_000_000,    // 1 SOL
        data: "0x" + accountData,   // hex encoded data
        owner: programId.toString(),
        executable: false,
      }
    ],
  }),
});
```

### Tổng hợp Cheatcodes


| Cheatcode                     | Dùng để                              |
| ----------------------------- | ------------------------------------ |
| `surfnet_setTokenAccount`     | Nạp bất kỳ token nào                 |
| `surfnet_setAccount`          | Set data, lamport, owner của account |
| `surfnet_cloneProgramAccount` | Copy program từ ID này sang ID khác  |
| `surfnet_profileTransaction`  | Debug compute units chi tiết         |
| `surfnet_setProgramAuthority` | Thay đổi upgrade authority           |
| `surfnet_setSupply`           | Điều chỉnh tổng cung SOL             |


---

## 6. Infrastructure as Code (IaC)

Đây là phần thứ hai — và quan trọng không kém — của Surfpool.

### Vấn Đề Với Cách Deploy Thông Thường

Khi bạn deploy một Solana program lên production, quy trình thường là:

```bash
# Ai đó chạy trên máy local
anchor build
anchor deploy --provider.cluster mainnet

# Xong, không ai biết:
# - Ai deploy?
# - Lúc nào?
# - Với keypair nào?
# - Initialize accounts theo thứ tự gì?
# - Nếu cần replay lại thì làm thế nào?
```

Không có audit trail. Không reproducible. Không an toàn.

### IaC Giải Quyết Điều Đó

Surfpool dùng ngôn ngữ khai báo (dựa trên HCL — cùng ngôn ngữ của Terraform) để mô tả **toàn bộ infrastructure** của bạn như code:

```hcl
# surfpool.tx (file khai báo infrastructure)

# Khai báo signer — ai được phép deploy
signer "deployer" "svm::secret_key" {
  secret_key = env.DEPLOYER_SECRET_KEY
}

# Deploy program
action "deploy_bank_app" "svm::deploy_program" {
  description = "Deploy bank-app program lên devnet"
  program     = "target/deploy/bank_app.so"
  keypair     = "target/deploy/bank_app-keypair.json"
  signer      = signer.deployer
}

# Initialize sau khi deploy
action "initialize_bank" "svm::send_transaction" {
  description  = "Initialize bank-app state"
  depends_on   = [action.deploy_bank_app]
  instructions = [bank_app.initialize()]
  signer       = signer.deployer
}
```

Sau đó chạy:

```bash
# Xem plan — tương tự terraform plan
surfpool runbook plan surfpool.tx

# Thực thi
surfpool runbook run surfpool.tx
```

### Tại Sao IaC Quan Trọng Với Solana?

**1. Reproducible:** Bất kỳ ai trong team cũng có thể chạy cùng deployment với cùng kết quả.

**2. Auditable:** File `surfpool.tx` commit vào git — mọi thay đổi infrastructure đều có lịch sử rõ ràng. Security team có thể review trước khi deploy.

**3. Transition từ localnet lên mainnet:** Chỉ cần đổi network config, không cần viết lại script.

```hcl
# Đổi từ localnet sang mainnet chỉ bằng cách đổi network
network "target" {
  rpc_url = "https://api.mainnet-beta.solana.com"
  # Trước đó là: rpc_url = "http://127.0.0.1:8899"
}
```

**4. Signing infrastructure an toàn hơn:**

```hcl
# Development: dùng keypair file
signer "deployer" "svm::secret_key" {
  secret_key = env.DEPLOYER_KEY
}

# Production: dùng Squads multisig — chỉ đổi signer config
signer "deployer" "svm::squads_multisig" {
  multisig_address = "AbCd..."
  threshold        = 3
}
```

---

## 7. Surfpool Studio

Surfpool Studio là giao diện web chạy tự động cùng Surfnet, cung cấp visual dashboard để:

- Xem transactions realtime theo từng slot
- Inspect account data trước và sau mỗi transaction
- Profile compute units theo từng instruction
- Time travel — warp đến slot bất kỳ bằng UI
- Nạp token vào account qua giao diện

Truy cập tại `http://localhost:8900` sau khi chạy `surfpool start`.

---

## 8. So Sánh Với solana-test-validator


| Tính năng           | solana-test-validator | Surfpool / Surfnet                      |
| ------------------- | --------------------- | --------------------------------------- |
| Boot time           | Chậm                  | Rất nhanh (chạy được trên Raspberry Pi) |
| Mainnet data        | ❌                     | ✅ Lazy fork                             |
| Token faucet        | ❌ Chỉ SOL             | ✅ Bất kỳ token nào                      |
| Time travel         | ❌                     | ✅ Cheatcodes                            |
| Compute profiling   | ❌                     | ✅ Chi tiết theo instruction             |
| IaC deployment      | ❌                     | ✅                                       |
| Drop-in replacement | —                     | ✅ Cùng port, cùng API                   |
| Tích hợp Anchor     | ✅                     | ✅                                       |


---

## 9. Thực Hành 💪

Dùng bank-app đã build từ các bài trước để thực hành với Surfpool.

### Phần 1: Thiết Lập Surfnet

1. Cài Surfpool và start Surfnet
2. Deploy bank-app lên Surfnet thay vì `solana-test-validator`
3. Chạy lại test suite hiện tại — xác nhận mọi test vẫn pass

### Phần 2: Dùng Cheatcodes

1. Dùng `surfnet_setTokenAccount` để nạp USDC vào ví test, sau đó dùng USDC đó để deposit vào bank-app
2. Nếu bank-app có tính năng nào phụ thuộc vào thời gian (cooldown, lock period), dùng cheatcode để advance clock và test tính năng đó
3. Dùng `surfnet_profileTransaction` để profile instruction `deposit` — ghi lại compute units tiêu thụ

### Phần 3: Infrastructure as Code

1. Tạo file `surfpool.tx` mô tả deployment của bank-app
2. Khai báo signer, deploy action, và initialize action theo đúng thứ tự
3. Chạy `surfpool runbook plan` để xem plan trước khi thực thi
4. Chạy `surfpool runbook run` và xác nhận kết quả giống với deploy thủ công

---

## 🎓 Tổng Kết

Bạn đã hoàn thành toàn bộ khóa học lập trình Solana. Nhìn lại những gì đã học:

```
Phần 1-5:   Nền tảng — Transaction, Account, PDA, ATA, CPI
Phần 6:     Versioned Transaction & Address Lookup Tables
Phần 7:     Instruction Ordering, Sysvar, Runtime Constraints
Phần 8:     Anchor IDL — đọc, tạo CPI crate, gọi raw instruction
Phần 9:     Surfpool — môi trường phát triển production-ready
```

Surfpool đánh dấu sự trưởng thành trong workflow Solana của bạn:

- **Surfnet** cho bạn test với data thật, không cần mainnet
- **Cheatcodes** cho bạn kiểm soát hoàn toàn state khi test
- **IaC** biến deployment thành code — auditable, reproducible, an toàn

Đây là cách các team DeFi nghiêm túc làm việc. Bây giờ bạn cũng làm được vậy.

---

## Tài Nguyên

- [Tài liệu chính thức Surfpool](https://docs.surfpool.run)
- [GitHub — solana-foundation/surfpool](https://github.com/txtx/surfpool)
- [Bài viết Helius: Giới thiệu Surfpool](https://www.helius.dev/blog/surfpool)
- [Solana Docs: Surfpool CLI Basics](https://solana.com/docs/intro/installation/surfpool-cli-basics)

