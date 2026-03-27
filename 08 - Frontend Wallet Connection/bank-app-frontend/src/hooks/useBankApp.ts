import { useCallback, useEffect, useState } from 'react';
import { useConnection, useAnchorWallet } from '@solana/wallet-adapter-react';
import { AnchorProvider, BN, Program } from '@coral-xyz/anchor';
import { PublicKey, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import idl from '../idl/bank_app.json';

function useBankApp() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  const [program, setProgram] = useState<Program | null>(null);
  const [userReserve, setUserReserve] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!wallet) {
      setProgram(null);
      return;
    }
    const provider = new AnchorProvider(connection, wallet, {
      commitment: 'confirmed',
    });
    const prog = new Program(idl as any, provider);
    setProgram(prog);
  }, [connection, wallet]);

  const getPDAs = useCallback(() => {
    if (!program || !wallet) return null;

    const [bankInfo] = PublicKey.findProgramAddressSync(
      [Buffer.from('BANK_INFO_SEED')],
      program.programId
    );
    const [bankVault] = PublicKey.findProgramAddressSync(
      [Buffer.from('BANK_VAULT_SEED')],
      program.programId
    );
    const [userReservePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('USER_RESERVE_SEED'), wallet.publicKey.toBuffer()],
      program.programId
    );

    return { bankInfo, bankVault, userReserve: userReservePda };
  }, [program, wallet]);

  const fetchUserReserve = useCallback(async () => {
    if (!program || !wallet) return;
    const pdas = getPDAs();
    if (!pdas) return;

    try {
      const data = await (program.account as any).userReserve.fetch(pdas.userReserve);
      setUserReserve(data.depositedAmount.toNumber() / LAMPORTS_PER_SOL);
    } catch {
      setUserReserve(0);
    }
  }, [program, wallet, getPDAs]);

  useEffect(() => {
    fetchUserReserve();
  }, [fetchUserReserve]);

  const deposit = useCallback(async (amountInSol: number) => {
    if (!program || !wallet) return;
    const pdas = getPDAs();
    if (!pdas) return;

    setLoading(true);
    setError(null);
    setTxSignature(null);

    try {
      const amountInLamports = new BN(amountInSol * LAMPORTS_PER_SOL);

      const tx = await program.methods
        .deposit(amountInLamports)
        .accounts({
          bankInfo: pdas.bankInfo,
          bankVault: pdas.bankVault,
          userReserve: pdas.userReserve,
          user: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      setTxSignature(tx);
      await fetchUserReserve();
    } catch (err: any) {
      setError(err.message || 'Giao dịch thất bại');
    } finally {
      setLoading(false);
    }
  }, [program, wallet, getPDAs, fetchUserReserve]);

  return {
    deposit,
    userReserve,
    loading,
    txSignature,
    error,
    fetchUserReserve,
    isReady: !!program && !!wallet,
  };
}

export default useBankApp;
