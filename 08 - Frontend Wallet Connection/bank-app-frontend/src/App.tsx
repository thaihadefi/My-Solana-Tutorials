import { useWallet } from '@solana/wallet-adapter-react';
import WalletConnect from './components/WalletConnect';
import WalletInfo from './components/WalletInfo';
import BankAppInteract from './components/BankAppInteract';

function App() {
  const { connected } = useWallet();

  return (
    <div className="app">
      <header className="app-header">
        <h1>🏦 Bank App</h1>
        <p className="app-subtitle">Solana dApp on Devnet</p>
        <WalletConnect />
      </header>

      <main className="app-main">
        {connected ? (
          <>
            <WalletInfo />
            <BankAppInteract />
          </>
        ) : (
          <div className="connect-prompt">
            <h2>Chào mừng đến với Bank App</h2>
            <p>Kết nối ví Phantom của bạn để bắt đầu gửi và rút SOL.</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
