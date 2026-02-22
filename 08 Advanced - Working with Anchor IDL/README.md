# 08 – Làm việc với Anchor IDL
Bài học trước thật khó khăn phải không? Đừng lo lắng! Bài này sẽ rất dễ và trực diện.


Đến cuối bài học này, bạn sẽ:
- Hiểu cấu trúc và mục đích của Anchor IDL
- Biết cách IDL được tạo ra, lưu trữ và cập nhật on-chain
- Biết cách tìm kiếm IDL
- Biết cách từ IDL tạo ra một crate để thực hiện CPI.


## 1. IDL là gì?

"Một tệp Interface Description Language (IDL) cho một chương trình Anchor cung cấp một tệp JSON được tiêu chuẩn hóa mô tả các chỉ dẫn (instructions) và tài khoản (accounts) của chương trình. Tệp này đơn giản hóa quá trình tích hợp chương trình on-chain của bạn với các ứng dụng phía khách hàng (client applications)." - Trích dẫn từ trang web của Anchor.

Về cơ bản, IDL không phải là chương trình của bạn - nó là một bản mô tả bằng JSON cho các client biết cách tương tác với chương trình của bạn. Hãy nghĩ về nó như là tài liệu API của chương trình, nhưng được cấu trúc dành cho máy tính đọc. 

Bạn sẽ sử dụng tài liệu này để chạy chương trình sau khi deploy thông qua JS/TS, hoặc để tương tác với các chương trình khác.

Nó bao gồm:
- **Instructions**: Chữ ký hàm, các kiểu tham số và các tài khoản bắt buộc
- **Accounts**: Các định nghĩa struct cho dữ liệu do chương trình sở hữu
- **Types**: Các kiểu dữ liệu tùy chỉnh được sử dụng xuyên suốt các chỉ dẫn
- **Events**: Các cấu trúc dữ liệu nhật ký (log) được phát ra
- **Errors**: Các mã lỗi và thông báo lỗi tùy chỉnh


```rust
{
  "version": "0.1.0",
  "name": "bank_app",
  "instructions": [
    {
      "name": "initialize",
      "accounts": [
        { "name": "authority", "isMut": true, "isSigner": true },
        { "name": "bankInfo", "isMut": true, "isSigner": false }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "BankInfo",
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "authority", "type": "publicKey" },
          { "name": "isPaused", "type": "bool" }
        ]
      }
    }
  ]
}
```

## IDL được tạo ra như thế nào?

Khi bạn chạy lệnh `anchor build` hoặc `anchor idl build`, Anchor sẽ:
- Phân tích cú pháp mã nguồn Rust của bạn để trích xuất chữ ký chỉ dẫn, cấu trúc tài khoản và các kiểu dữ liệu.
- Tạo một tệp JSON IDL tại `target/idl/<program_name>.json`
- Tạo các kiểu dữ liệu TypeScript tại `target/types/<program_name>.ts (được suy ra từ IDL)`

Nếu bạn chạy lệnh `anchor idl init -f <target/idl/program.json> <program-id>`, Anchor sẽ tạo một tài khoản idl, được sở hữu bởi chính chương trình đó. Lưu ý rằng, đây không phải là mặc định - nghĩa là IDL không tự động được tải lên on-chain nếu bạn chạy lệnh `anchor deploy`.

Hầu hết thời gian, tôi không thấy ai sử dụng tính năng này, không ai tải IDL của chương trình lên on-chain cả :D. Trong trường hợp đó, làm sao bạn có thể tìm thấy IDL của một chương trình?

## Tìm kiếm IDLs
Phương pháp đơn giản nhất là thông qua lưu trữ on-chain, sử dụng Anchor CLI:
```rust
anchor idl fetch -p mainnet <PROGRAM_ID> // thay mainnet thành devnet nếu chương trình của bạn ở devnet
```
Nhưng tôi khá chắc chắn là hầu hết các lần bạn sẽ thấy một trong những lỗi sau:
```
# Error: IDL not found
# Điều này có nghĩa là:
# 1. Chương trình chưa từng tải IDL lên (cách triển khai cũ)
# 2. IDL đã bị xóa (sử dụng anchor idl erase)
# 3. Chương trình không phải là chương trình Anchor
```
Đơn giản là vì không ai khởi tạo/tải IDL lên on-chain.

Vậy phải làm gì? Tôi khá chắc rằng, nếu bạn đang đọc bài này, bạn đang làm việc cho một giao thức DeFi, hoặc đang tự học để tương tác với một giao thức DeFi. 

Trong trường hợp này, cách hữu ích nhất là: Tìm kiếm trên web, và hầu hết mọi lúc bạn sẽ tìm thấy thứ mình cần trong Github của giao thức, hoặc thông qua tài liệu (Doc) trên trang web của họ (thường sẽ dẫn đến Gitbook/Github).
Ví dụ: [Jupiter Earn](https://github.com/jup-ag/jupiter-lend/blob/main/docs/earn/cpi.md)

Nếu bạn không thể tìm thấy Github hoặc Doc, hoặc đơn giản là họ không có, hoặc không phải DeFi, bạn có thể sử dụng [IDL Extractor](https://github.com/dvrvsimi/solana-idl-extractor), mọi hướng dẫn đều có trong repo, lưu ý rằng IDL trích xuất được cũng không giống hoàn toàn 100% so với chương trình.


## Cấu trúc IDL (>0.30)
```rust
{
  "instructions": [
    {
      "name": "deposit",
      "accounts": [
        {
          "name": "user",
          "isMut": true,
          "isSigner": true,
          "docs": ["Người dùng đang gửi SOL"]
        },
        {
          "name": "bankVault",
          "isMut": true,
          "isSigner": false,
          "pda": {
            "seeds": [
              { "kind": "const", "value": [98, 97, 110, 107, 45, 118, 97, 117, 108, 116] }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ],
      "returns": null
    }
  ]
}
```

Các trường (Fields):
-  `name`: Tên chỉ dẫn (phải trùng khớp với hàm trong Rust)
- `accounts`: Danh sách các tài khoản bắt buộc với cờ (flags) mutability và signer
- `args`: Các tham số chỉ dẫn cùng với kiểu dữ liệu
- `returns`: Kiểu dữ liệu trả về (thường là null đối với các chương trình Solana)
- `pda`: Thông tin dẫn xuất PDA

Phần Accounts:
```rust
{
  "accounts": [
    {
      "name": "BankInfo",
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "authority", "type": "publicKey" },
          { "name": "isPaused", "type": "bool" },
          { "name": "bump", "type": "u8" }
        ]
      }
    }
  ]
}
```
Phần Types:
```rust
{
  "types": [
    {
      "name": "DepositEvent",
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "user", "type": "publicKey" },
          { "name": "amount", "type": "u64" },
          { "name": "timestamp", "type": "i64" }
        ]
      }
    }
  ]
}
```
Phần Errors:

```rust
{
  "errors": [
    {
      "code": 6000,
      "name": "Unauthorized",
      "msg": "Bạn không có quyền thực hiện hành động này"
    },
    {
      "code": 6001,
      "name": "InsufficientFunds",
      "msg": "Không đủ tiền để thực hiện thao tác này"
    }
  ]
}
```

## IDL tới Giao diện Chương trình (Program Interface)
Bạn có bao giờ thắc mắc rằng nếu chúng ta có một IDL, liệu chúng ta có thể tạo giao diện chương trình, hoặc CPI để tương tác với smart contract đó không? Có, và [github repo này](https://github.com/saber-hq/anchor-gen) sẽ giúp bạn làm điều đó.
Hướng dẫn trong repo không đủ rõ ràng nên tôi sẽ giúp bạn.
1. Sử dụng lệnh `cargo init` để tạo dự án mới.
2. Thêm đoạn sau vào tệp Cargo.toml trong một crate mới:
```toml
[dependencies]
anchor-gen = "0.3.1"
```
3. Trong dự án đó, đổi tên `main.rs` thành `lib.rs`, và viết: 
```rust
anchor_gen::generate_cpi_crate!("../../path/to-idl/idl.json"); 
```
4. Chạy `cargo build` và bạn sẽ có CPI. Repo `anchor-gen` không tạo ra tệp Rust cho CPI, nó tạo ra CPI **nội bộ** sử dụng proc macro, có thể xem được bằng lệnh `cargo expand`.

5. Sau khi tạo xong crate CPI, bạn thực hiện import nó:


!!! Lưu ý rằng: `anchor-gen = 0.3.1` sẽ chỉ hoạt động với các phiên bản anchor dưới v0.29.0, và đối với phiên bản >0.30 bạn cần sử dụng `0.4.1` vì định dạng IDL đã thay đổi.

| Phiên bản Anchor | Các trường tài khoản IDL |
|---------------|-------------------|
| ≤ 0.29.x      | `isSigner`, `isMut` |
| ≥ 0.30.0      | `signer`, `writable`     |


Và bạn đã sẵn sàng. 



## Bài tập
Bây giờ hãy tự mình thử nghiệm. Sử dụng `anchor-gen`, chuyển đổi tệp idl.json (từ staking-app), sử dụng CPI được tạo ra đó, thay đổi phần import trong `bank-app`, và chạy thử nghiệm (test). Kết quả sẽ tương tự như phiên bản mã nguồn cũ của bạn, khi không sử dụng crate.