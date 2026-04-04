# Phần IX - Surfpool: Fork Mainnet về Localnet & Debug như Production

Ở các phần trước, chúng ta tập trung vào **viết program đúng và an toàn** (PDA/ATA/CPI), **tối ưu runtime** (compute/stack), và **xây client tốt hơn** (IDL, versioned transaction).

Vấn đề còn lại khi build Solana app “thật” là: **debug và test trong bối cảnh giống Mainnet**.

- `solana-test-validator` rất tốt để chạy localnet, nhưng **state** thường “đồ chơi” (token/pool/account không giống thực tế).
- Chạy trên Devnet/Mainnet thì chậm hơn, tốn thời gian setup, và debug khó hơn.

**Surfpool** (Solana Foundation) giải quyết khoảng trống đó: một công cụ local dev thay thế `solana-test-validator`, có thể **tải program + account từ mainnet/devnet “just-in-time”** về local, kèm **Surfpool Studio** để quan sát transaction, và **Surfnet RPC cheatcodes** để tạo test case/edge-case nhanh.

---

Kết thúc bài học, bạn sẽ:

- Hiểu Surfpool/Surfnet là gì và khác gì so với `solana-test-validator`
- Chạy một “surfnet” local và fork state từ `mainnet/devnet`
- Dùng Surfpool Studio để debug: logs, decoded instructions, account diffs, CU profiling
- Biết các tuỳ chọn CLI quan trọng (port, network, slot-time, watch, snapshot, CI mode)
- Dùng cheatcodes RPC để “bẻ” state phục vụ test (reset, time travel, set SOL/SPL balances, clone program)
- Làm một case study thực tế: **test deposit USDC** chạy local nhưng dùng **mint mainnet thật**

---

## 1. Surfpool là gì? Khi nào nên dùng?

Theo docs, Surfpool là “drop-in replacement” cho `solana-test-validator`, mục tiêu:

- **Full RPC compatibility** (Solana JSON-RPC hoạt động như bình thường)
- **Mainnet fork (lazy / just-in-time)**: khi transaction cần đọc account/program nào, Surfpool sẽ fetch từ cluster datasource và cache vào surfnet local
- **Cheatcodes**: RPC methods bổ sung để thao tác state cho testing
- **Studio**: giao diện quan sát tx, account changes, compute profiling

### Khi nên dùng Surfpool

- Bạn muốn test against **state thật** (mint phổ biến như USDC, program bên thứ ba, account layout “lạ”…)
- Bạn muốn debug nhanh: “giao dịch thay đổi byte nào?”, instruction nào ăn CU nhiều?
- Bạn muốn tạo edge-case (thiếu balance, frozen token account, time-based) mà không muốn viết quá nhiều setup code

### Khi KHÔNG cần Surfpool

- Unit test đơn giản, state tự tạo hết → `solana-test-validator`/Anchor test vẫn đủ.
- Bạn cần pipeline CI cực tối giản → cân nhắc Surfpool `--ci` hoặc validator thường.

---

## 2. Cài đặt Surfpool

Theo trang chủ/docs, cách cài đơn giản nhất:

```bash
curl -sL https://run.surfpool.run/ | bash
```

Kiểm tra:

```bash
surfpool --help
surfpool start --help
```

---

## 3. Chạy Surfnet local (thay cho solana-test-validator)

Khởi chạy mặc định:

```bash
surfpool start
```

Mặc định RPC/WSS:

- RPC: `http://127.0.0.1:8899`
- WS: `ws://127.0.0.1:8900`

Điều này khiến hầu hết tooling (Anchor, web3.js, solana CLI, wallets) dùng được “gần như không đổi”.

### 3.1 Chọn datasource network để fork state

Fork từ Mainnet (giống production nhất):

```bash
surfpool start --network mainnet
```

Fork từ Devnet:

```bash
surfpool start --network devnet
```

Chỉ định RPC URL tuỳ ý:

```bash
surfpool start --rpc-url <YOUR_RPC_URL>
```

### 3.2 Điều chỉnh tốc độ slot / chế độ sản xuất block

Slot time nhanh hơn:

```bash
surfpool start --slot-time 200
```

Block production mode:

- `clock` (mặc định): chạy theo thời gian
- `transaction`: tạo block khi có transaction (thường giúp test “đỡ chờ”)
- `manual`: tự điều khiển (hợp test time-based nâng cao)

```bash
surfpool start --block-production-mode transaction
```

---

## 4. Surfpool Studio

Sau khi chạy `surfpool start`, mở Studio:

- `http://127.0.0.1:18488`

Studio rất hữu ích để:

- Xem **decoded instructions + accounts + logs**
- Xem **byte-level diffs** (account data trước/sau)
- Xem **CU profiling** theo transaction/instruction
- Dùng **UI faucet** (tuỳ phiên bản) để airdrop SOL/token

### Checklist debug nhanh trong Studio

- **Instruction decode**: data/args có đúng không?
- **Account list**: có thiếu account nào không, thứ tự có đúng không?
- **Writable accounts**: account nào bị mutate? có mutate sai chỗ không?
- **Logs**: lỗi thực sự nằm ở đâu (Anchor constraint, token error, CPI error…)?
- **Compute**: instruction/CPI nào ăn CU bất thường?

---

## 5. Kết nối Anchor / web3.js / solana CLI vào Surfpool

### 5.1 web3.js

```ts
import { Connection } from "@solana/web3.js";

const connection = new Connection("http://127.0.0.1:8899", "confirmed");
```

### 5.2 solana CLI

```bash
solana config set --url http://127.0.0.1:8899
solana config get
```

### 5.3 Ví dụ thực tế: gửi 1 transaction và xem ngay trong Studio

1. Start Surfnet:

```bash
surfpool start --network devnet
```

1. Chạy một Anchor test hoặc một script web3.js (ví dụ: chuyển SOL, gọi 1 instruction).
2. Mở Studio `http://127.0.0.1:18488` và tìm transaction vừa gửi, rồi áp checklist debug ở phần 4.

---

## 6. Các tuỳ chọn CLI quan trọng khi làm dự án thật

- **Đổi port**:

```bash
surfpool start --port 8899 --ws-port 8900 --studio-port 18488
```

- **Tắt Studio/TUI để nhẹ máy**:

```bash
surfpool start --no-studio --no-tui
```

- **Watch & auto-deploy khi `.so` thay đổi** (hữu ích khi develop Anchor):

```bash
surfpool start --watch
```

- **Snapshot preload**: nạp account từ file JSON snapshot (repeatable):

```bash
surfpool start --snapshot ./snapshots/accounts.json
```

- **CI mode**: tắt profiling/studio/tui và giảm log:

```bash
surfpool start --ci
```

---

## 7. Cheatcodes RPC: tạo test case “nhanh như hack”

Cheatcodes là RPC methods chỉ có trên Surfnet, giúp bạn thao tác state trực tiếp.

Một số method nổi bật (theo Surfpool Docs):

- `surfnet_resetNetwork`
- `surfnet_timeTravel`
- `surfnet_setAccount`
- `surfnet_setTokenAccount`
- `surfnet_cloneProgramAccount`
- `surfnet_profileTransaction`
- `surfnet_getProfileResultsByTag`

### 7.1 Ví dụ: reset network về trạng thái sạch

```bash
curl -sS -X POST http://127.0.0.1:8899 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "id":1,
    "method":"surfnet_resetNetwork",
    "params":[]
  }'
```

### 7.2 Ví dụ: cấp USDC cho ví test (không cần faucet)

Cheatcode `surfnet_setTokenAccount` set token balance theo `owner + mint`.

Ví dụ cấp 100 USDC (6 decimals) cho một ví:

- `OWNER_PUBKEY`: ví của bạn (base58)
- USDC mint mainnet: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`
- `amount`: 100 USDC = `100000000` (đơn vị nhỏ nhất)

```bash
curl -sS -X POST http://127.0.0.1:8899 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "id":1,
    "method":"surfnet_setTokenAccount",
    "params":[
      "<OWNER_PUBKEY>",
      "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      {
        "amount": 100000000,
        "state": "initialized"
      },
      "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
    ]
  }'
```

> Nếu bạn đang fork `--network mainnet`, việc dùng đúng mint mainnet giúp bạn test “realistic” hơn nhiều (decimals, metadata, các tài khoản liên quan).

### 7.3 Ví dụ: set SOL balance cho ví bằng `surfnet_setAccount`

```bash
curl -sS -X POST http://127.0.0.1:8899 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "id":1,
    "method":"surfnet_setAccount",
    "params":[
      "<OWNER_PUBKEY>",
      {
        "lamports": 2000000000,
        "owner": "11111111111111111111111111111111",
        "executable": false,
        "rentEpoch": 0,
        "data": "0x"
      }
    ]
  }'
```

### 7.4 Ví dụ: clone một program account

Khi bạn cần “nhân bản” một program account (kèm program data) sang một ID khác để thử nghiệm:

```bash
curl -sS -X POST http://127.0.0.1:8899 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "id":1,
    "method":"surfnet_cloneProgramAccount",
    "params":[
      "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
      "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
    ]
  }'
```

### 7.5 Ví dụ: profile một VersionedTransaction để tìm “CU hotspot”

Bạn serialize một `VersionedTransaction` rồi base64-encode, sau đó gọi `surfnet_profileTransaction`.

```bash
curl -sS -X POST http://127.0.0.1:8899 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "id":1,
    "method":"surfnet_profileTransaction",
    "params":[
      "<BASE64_SERIALIZED_VERSIONED_TX>",
      "cu-hotspot-demo",
      { "depth":"instruction", "encoding":"base64" }
    ]
  }'
```

Lấy kết quả theo tag:

```bash
curl -sS -X POST http://127.0.0.1:8899 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "id":1,
    "method":"surfnet_getProfileResultsByTag",
    "params":[
      "cu-hotspot-demo",
      { "depth":"instruction", "encoding":"base64" }
    ]
  }'
```

---

## 8. Workflow gợi ý: Debug một bug “chỉ xảy ra trên mainnet state”

1. Chạy Surfpool với `--network mainnet`
2. Reproduce transaction/instruction của bạn bằng client/test
3. Mở Studio để xem:
  - decoded instruction data có đúng không?
  - account list có đúng thứ tự không?
  - account nào thay đổi và thay đổi bytes nào?
  - CPI nào ăn CU bất thường?
4. Nếu cần test edge-case:
  - dùng cheatcodes để set SOL/token/time và chạy lại
5. Khi đã fix, đóng Surfnet và chạy test suite bình thường để đảm bảo không “overfit” vào cheatcodes

---

## 9. Case study (thực tế): test “deposit USDC” chạy local nhưng dùng mainnet mint

Mục tiêu: học viên thấy rõ fork state + cheatcodes giúp viết test tích hợp nhanh như thế nào.

### Setup

1. Start Surfnet:

```bash
surfpool start --network mainnet
```

1. Bơm USDC vào ví test bằng `surfnet_setTokenAccount` (mục 7.2).
2. Chạy bài test `deposit` của bạn trỏ RPC local.

### Checklist debug trong Studio (khi test fail)

- User ATA của USDC có tồn tại chưa? (đúng `owner + mint` chưa)
- Bank vault ATA có tồn tại chưa? Ai là owner? (PDA hay keypair?)
- Instruction accounts có đúng thứ tự không (nhất là khi build raw ix/IDL)?
- Logs là lỗi gì (Anchor constraint / token error / owner mismatch / insufficient funds)?
- CU spike nằm ở deserialize account lớn hay ở CPI token transfers?

---

## 10. Bài tập

### Bài tập 1: Chạy Surfpool và kết nối test suite

- Start Surfpool với `--network devnet`
- Đảm bảo Anchor test hoặc một script web3.js có thể gửi 1 transaction đơn giản lên `http://127.0.0.1:8899`
- Mở Studio và xác nhận bạn thấy transaction đó

### Bài tập 2: Fork state và debug bằng diffs

- Chạy Surfpool với `--network mainnet`
- Chọn một thao tác “có state change rõ” trong program của bạn (deposit/withdraw)
- Thực thi và dùng Studio để:
  - tìm account nào bị mutate
  - đọc byte-level diff (hoặc view data trước/sau)
  - ghi lại instruction nào ăn CU nhiều nhất

### Bài tập 3: Cheatcode để tạo test case

- Reset network
- Dùng một cheatcode để:
  - set SOL balance hoặc SPL token balance cho một ví test
  - (tuỳ chọn) time travel để test logic dựa trên thời gian
- Chạy lại test của bạn và xác nhận bạn đã tạo được edge-case mong muốn (ví dụ: đủ/thiếu balance, qua epoch, v.v.)

---

## 11. Tài liệu tham khảo

- Solana docs (Surfpool basics): `https://solana.com/docs/intro/installation/surfpool-cli-basics`
- Surfpool Docs: `https://docs.surfpool.run/`
- CLI Commands: `https://docs.surfpool.run/toolchain/cli`
- Surfnet overview: `https://docs.surfpool.run/rpc/overview`
- Cheatcodes: `https://docs.surfpool.run/rpc/cheatcodes`

