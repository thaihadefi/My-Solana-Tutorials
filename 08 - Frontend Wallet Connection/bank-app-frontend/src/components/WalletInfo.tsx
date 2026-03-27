import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useEffect, useState, useCallback } from 'react';

function WalletInfo() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [balance, setBalance] = useState<number | null>(null);

  const fetchBalance = useCallback(async () => {
    if (!publicKey) return;
    try {
      const bal = await connection.getBalance(publicKey);
      setBalance(bal / LAMPORTS_PER_SOL);
    } catch (err) {
      console.error('Failed to fetch balance:', err);
    }
  }, [publicKey, connection]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  if (!publicKey) return null;

  const shortAddress = `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`;

  return (
    <div className="card wallet-info">
      <h3>Thông tin Ví</h3>
      <div className="info-row">
        <span className="label">Địa chỉ</span>
        <span className="value" title={publicKey.toBase58()}>{shortAddress}</span>
      </div>
      <div className="info-row">
        <span className="label">Số dư</span>
        <span className="value">{balance !== null ? `${balance.toFixed(4)} SOL` : 'Đang tải...'}</span>
      </div>
      <div className="info-row">
        <span className="label">Network</span>
        <span className="value">Devnet</span>
      </div>
      <button className="btn btn-secondary" onClick={fetchBalance}>
        Làm mới số dư
      </button>
    </div>
  );
}

export default WalletInfo;
