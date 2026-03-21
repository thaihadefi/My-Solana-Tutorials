# Phần IX - Frontend: Kết nối Ví Phantom và Tương tác với Solana Program

Qua các bài học trước, bạn đã viết smart contract, test bằng script, làm việc với PDA, CPI, IDL... Tất cả đều chạy trong terminal. Nhưng người dùng thực sự không dùng terminal — họ dùng trình duyệt web. Đã đến lúc kết nối mọi thứ lại và xây dựng giao diện cho Bank App của bạn!

### Trong phần này, bạn sẽ:

✅ Hiểu cách ví Phantom hoạt động và giao tiếp với dApp  
✅ Thiết lập dự án React + Vite với Solana Wallet Adapter  
✅ Kết nối và ngắt kết nối ví Phantom  
✅ Hiển thị thông tin ví (địa chỉ, số dư SOL)  
✅ Gọi instruction trên Solana program từ frontend (deposit vào Bank App)  
✅ Đọc dữ liệu on-chain (fetch UserReserve) và hiển thị  

Sau khi hoàn thành phần này, bạn sẽ có một ứng dụng web hoàn chỉnh — từ smart contract đến giao diện người dùng — sẵn sàng cho bất kỳ ai sử dụng thông qua trình duyệt.

Bắt đầu thôi! 🌐💜

## 1. Ví Phantom và Wallet Adapter

### Phantom là gì?

Phantom là ví phổ biến nhất trên Solana. Khi người dùng cài đặt extension Phantom trên trình duyệt, nó sẽ inject một đối tượng `window.solana` vào mỗi trang web. Thông qua đối tượng này, dApp của bạn có thể:

- Yêu cầu kết nối ví (xin phép người dùng)
- Lấy public key của người dùng
- Yêu cầu người dùng ký và gửi giao dịch

Bạn có thể gọi trực tiếp `window.solana.connect()`, nhưng cách này không tối ưu — bạn sẽ phải tự xử lý nhiều edge case, hỗ trợ nhiều loại ví khác nhau (Solflare, Backpack...), và quản lý trạng thái kết nối.

### Solana Wallet Adapter

Thay vì gọi trực tiếp `window.solana`, cộng đồng Solana đã xây dựng **Solana Wallet Adapter** — một bộ thư viện React giúp bạn:

- Hỗ trợ hàng chục loại ví chỉ với vài dòng config
- Cung cấp UI sẵn có (nút kết nối, modal chọn ví)
- Quản lý trạng thái kết nối qua React Context
- Cung cấp các hooks tiện lợi: `useWallet()`, `useConnection()`, `useAnchorWallet()`

Các package cần cài:

```bash
npm install @solana/wallet-adapter-react @solana/wallet-adapter-react-ui @solana/wallet-adapter-phantom @solana/wallet-adapter-base @solana/web3.js @coral-xyz/anchor buffer
```

## 2. Thiết lập dự án React + Vite

### Bước 1: Tạo dự án

```bash
npm create vite@latest bank-app-frontend -- --template react-ts
cd bank-app-frontend
npm install
```

### Bước 2: Cài dependencies

```bash
npm install @solana/wallet-adapter-react @solana/wallet-adapter-react-ui @solana/wallet-adapter-phantom @solana/wallet-adapter-base @solana/web3.js @coral-xyz/anchor buffer
```

### Bước 3: Cấu hình Vite

Solana SDK sử dụng `Buffer` — một API của Node.js không có sẵn trong trình duyệt. Bạn cần polyfill nó.

Trong `vite.config.ts`:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { NodeGlobalsPolyfillPlugin } from '@esbuild-plugins/node-globals-polyfill'

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env': {},
    global: 'globalThis',
  },
  optimizeDeps: {
    esbuildOptions: {
      define: { global: 'globalThis' },
    },
  },
})
```

Và trong `src/main.tsx`, thêm dòng này ở đầu file:

```ts
import { Buffer } from 'buffer';
window.Buffer = Buffer;
```

Đây là bước quan trọng — nếu thiếu, bạn sẽ gặp lỗi `Buffer is not defined` khi chạy ứng dụng.

### Bước 4: Wrap App với Providers

Solana Wallet Adapter sử dụng React Context để chia sẻ trạng thái ví cho toàn bộ ứng dụng. Bạn cần wrap component `App` với 3 providers:

```tsx
// src/main.tsx
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { clusterApiUrl } from '@solana/web3.js';

const endpoint = clusterApiUrl('devnet');
const wallets = [new PhantomWalletAdapter()];

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ConnectionProvider endpoint={endpoint}>
    <WalletProvider wallets={wallets} autoConnect>
      <WalletModalProvider>
        <App />
      </WalletModalProvider>
    </WalletProvider>
  </ConnectionProvider>
);
```

Hãy phân tích:

- **ConnectionProvider**: Cung cấp kết nối RPC đến Solana cluster (devnet). Mọi component con đều có thể dùng `useConnection()` để lấy connection.
- **WalletProvider**: Quản lý trạng thái ví — ví nào đang kết nối, public key, hàm ký giao dịch. `autoConnect` sẽ tự động kết nối lại ví nếu người dùng đã kết nối trước đó.
- **WalletModalProvider**: Cung cấp UI modal để người dùng chọn ví khi nhấn nút kết nối.

## 3. Kết nối Ví Phantom

### Hook `useWallet()`

Đây là hook chính mà bạn sẽ dùng nhiều nhất:

```tsx
import { useWallet } from '@solana/wallet-adapter-react';

const { publicKey, connected, connect, disconnect } = useWallet();
```

- `publicKey`: Public key của ví đang kết nối (hoặc `null` nếu chưa kết nối)
- `connected`: Boolean — ví có đang kết nối không
- `connect()`: Yêu cầu kết nối ví
- `disconnect()`: Ngắt kết nối

### Component WalletConnect

Bạn có 2 lựa chọn:

**Cách 1: Dùng component có sẵn** (đơn giản nhất)

```tsx
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import '@solana/wallet-adapter-react-ui/styles.css';

function WalletConnect() {
  return <WalletMultiButton />;
}
```

`WalletMultiButton` tự động xử lý tất cả: hiển thị nút "Select Wallet", kết nối, hiển thị địa chỉ sau khi kết nối, và ngắt kết nối.

**Cách 2: Tự viết** (tùy chỉnh UI)

```tsx
function WalletConnect() {
  const { publicKey, connected, connect, disconnect } = useWallet();

  if (connected && publicKey) {
    return (
      <div>
        <span>{publicKey.toBase58().slice(0, 4)}...{publicKey.toBase58().slice(-4)}</span>
        <button onClick={disconnect}>Ngắt kết nối</button>
      </div>
    );
  }

  return <button onClick={connect}>Kết nối Phantom</button>;
}
```

### Component WalletInfo — Hiển thị số dư SOL

```tsx
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useEffect, useState } from 'react';

function WalletInfo() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [balance, setBalance] = useState<number>(0);

  useEffect(() => {
    if (!publicKey) return;
    connection.getBalance(publicKey).then(bal => {
      setBalance(bal / LAMPORTS_PER_SOL);
    });
  }, [publicKey, connection]);

  if (!publicKey) return null;

  return (
    <div>
      <p>Địa chỉ: {publicKey.toBase58().slice(0, 4)}...{publicKey.toBase58().slice(-4)}</p>
      <p>Số dư: {balance.toFixed(4)} SOL</p>
      <p>Network: Devnet</p>
    </div>
  );
}
```

Ở đây chúng ta dùng `connection.getBalance(publicKey)` — trả về số dư tính bằng **lamport** (1 SOL = 1,000,000,000 lamport), nên cần chia cho `LAMPORTS_PER_SOL`.

## 4. Tương tác với Bank App từ Frontend

Đây là phần thú vị nhất — bạn sẽ kết nối kiến thức từ các bài học trước:

- **Chương 8 (IDL)**: Dùng IDL để tạo Program instance
- **Chương 3 (PDA)**: Derive các PDA addresses phía client
- **Chương 3 (Deposit)**: Gọi instruction deposit

### Bước 1: Copy IDL

Sau khi `anchor build` ở Bank App, bạn sẽ có file `target/idl/bank_app.json`. Copy file này vào `src/idl/bank_app.json` trong dự án frontend.

IDL chính là "cầu nối" giữa frontend và smart contract — nó cho Anchor SDK biết program có những instruction nào, cần account nào, và kiểu dữ liệu ra sao. Đúng như bạn đã học ở Chương 8.

### Bước 2: Tạo AnchorProvider từ Wallet

Ở các bài trước, khi viết test, bạn dùng `anchor.AnchorProvider.env()` để tạo provider — nó tự lấy keypair từ file. Trên frontend, bạn cần tạo provider từ ví của người dùng:

```tsx
import { useAnchorWallet, useConnection } from '@solana/wallet-adapter-react';
import { AnchorProvider, Program } from '@coral-xyz/anchor';

const { connection } = useConnection();
const wallet = useAnchorWallet();

const provider = new AnchorProvider(connection, wallet, {
  commitment: 'confirmed',
});
```

`useAnchorWallet()` trả về một đối tượng tương thích với Anchor — nó bao gồm `publicKey` và hàm `signTransaction` mà Anchor cần để ký và gửi giao dịch.

### Bước 3: Tạo Program instance từ IDL

```tsx
import idl from '../idl/bank_app.json';

const program = new Program(idl as any, provider);
```

Giống hệt cách bạn đã làm ở Bài tập 2 Chương 8 — chỉ khác là thay vì dùng `anchor.workspace`, bạn dùng `new Program(idl, provider)` với IDL file.

### Bước 4: Derive PDA phía client

```tsx
import { PublicKey, SystemProgram } from '@solana/web3.js';

const [bankInfo] = PublicKey.findProgramAddressSync(
  [Buffer.from("BANK_INFO_SEED")],
  program.programId
);

const [bankVault] = PublicKey.findProgramAddressSync(
  [Buffer.from("BANK_VAULT_SEED")],
  program.programId
);

const [userReserve] = PublicKey.findProgramAddressSync(
  [Buffer.from("USER_RESERVE_SEED"), wallet.publicKey.toBuffer()],
  program.programId
);
```

Đây chính xác là cách bạn đã làm trong `tests/bank-app.ts` ở Chương 3 — vì PDA là deterministic, cùng seeds + program ID sẽ luôn cho ra cùng địa chỉ, dù ở test hay frontend.

### Bước 5: Gọi instruction Deposit

```tsx
const deposit = async (amountInSol: number) => {
  const amountInLamports = amountInSol * LAMPORTS_PER_SOL;

  const tx = await program.methods
    .deposit(new BN(amountInLamports))
    .accounts({
      bankInfo,
      bankVault,
      userReserve,
      user: wallet.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  console.log("Deposit tx:", tx);
};
```

Cú pháp hoàn toàn giống với test script! Sự khác biệt duy nhất là ở đây, khi gọi `.rpc()`, Phantom sẽ hiện popup yêu cầu người dùng xác nhận giao dịch — thay vì tự ký bằng keypair file.

### Bước 6: Fetch dữ liệu UserReserve

```tsx
const fetchUserReserve = async () => {
  try {
    const data = await program.account.userReserve.fetch(userReserve);
    return data.depositedAmount.toNumber();
  } catch {
    return 0; // account chưa tồn tại (chưa deposit lần nào)
  }
};
```

Anchor SDK tự decode dữ liệu nhờ IDL — bạn nhận được object JavaScript với các field giống hệt struct Rust (`depositedAmount` tương ứng `deposited_amount`).

### Tổng hợp: Custom Hook `useBankApp`

Trong dự án mẫu, toàn bộ logic trên được gom vào một custom hook `useBankApp.ts`. Component `BankAppInteract.tsx` chỉ cần gọi:

```tsx
const { deposit, userReserve, loading, txSignature } = useBankApp();
```

Và render UI — form nhập số lượng, nút Deposit, hiển thị UserReserve.

## 5. Đến lúc Xây dựng 💪

Bạn đã có một ứng dụng frontend hoàn chỉnh có thể kết nối ví và deposit SOL. Bây giờ hãy mở rộng nó.

🛠️ Nhiệm vụ của bạn:

1. **Hiển thị số dư Token SPL**

Sử dụng `connection.getTokenAccountsByOwner(publicKey, { programId: TOKEN_PROGRAM_ID })` để lấy danh sách tất cả token account của người dùng, rồi hiển thị chúng trong UI (mint address, số lượng).

💡 Gợi ý: Hàm này trả về raw account data. Bạn cần decode bằng `AccountLayout` từ `@solana/spl-token` hoặc dùng `getParsedTokenAccountsByOwner` để lấy data đã parse sẵn.

2. **Thêm chức năng Withdraw**

Tạo một form mới cho phép người dùng rút SOL từ Bank App. Gọi instruction `withdraw` tương tự như `deposit`, nhưng cần truyền thêm `bank_vault` bump seed.

💡 Gợi ý: Logic tương tự deposit — derive PDA, gọi `program.methods.withdraw(amount).accounts({...}).rpc()`.

3. **Hiển thị lịch sử giao dịch gần đây**

Sử dụng `connection.getSignaturesForAddress(publicKey, { limit: 10 })` để lấy 10 giao dịch gần nhất, rồi dùng `connection.getParsedTransaction(signature)` để lấy chi tiết từng giao dịch và hiển thị chúng.

🚀 Sau khi hoàn thành, bạn sẽ có một ứng dụng DeFi frontend hoàn chỉnh — từ kết nối ví, gửi/rút tiền, đến hiển thị lịch sử — sẵn sàng cho người dùng thực sự!
