import { useState } from 'react';
import useBankApp from '../hooks/useBankApp';

function BankAppInteract() {
  const { deposit, userReserve, loading, txSignature, error, fetchUserReserve, isReady } = useBankApp();
  const [amount, setAmount] = useState('');

  const handleDeposit = async () => {
    const sol = parseFloat(amount);
    if (isNaN(sol) || sol <= 0) return;
    await deposit(sol);
    setAmount('');
  };

  if (!isReady) {
    return (
      <div className="card">
        <p>Đang khởi tạo kết nối với program...</p>
      </div>
    );
  }

  return (
    <div className="card bank-interact">
      <h3>Bank App</h3>

      <div className="info-row">
        <span className="label">Số dư đã gửi</span>
        <span className="value highlight">{userReserve.toFixed(4)} SOL</span>
      </div>

      <div className="deposit-form">
        <input
          type="number"
          placeholder="Số lượng SOL"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          min="0"
          step="0.001"
          disabled={loading}
        />
        <button
          className="btn btn-primary"
          onClick={handleDeposit}
          disabled={loading || !amount}
        >
          {loading ? 'Đang xử lý...' : 'Deposit SOL'}
        </button>
      </div>

      {txSignature && (
        <div className="tx-result success">
          <p>Giao dịch thành công!</p>
          <a
            href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Xem trên Solana Explorer ↗
          </a>
        </div>
      )}

      {error && (
        <div className="tx-result error">
          <p>Lỗi: {error}</p>
        </div>
      )}

      <button className="btn btn-secondary" onClick={fetchUserReserve}>
        Làm mới dữ liệu
      </button>
    </div>
  );
}

export default BankAppInteract;
