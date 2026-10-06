import { useRef, useState } from 'react';
import { publicClient, buyToken, getEthBalance, translateError } from '../web3/client.js';

export default function useTransaction({ onBusy, onConfirmed }) {
  const [tx, setTx] = useState({ state: 'idle' });
  const locked = useRef(false);
  const context = useRef(null);
  async function confirm(hash) {
    const current = context.current;
    try {
      let cancelled = false;
      const receipt = await publicClient.waitForTransactionReceipt({ hash, onReplaced: (replacement) => {
        hash = replacement.transactionReceipt.transactionHash;
        cancelled = replacement.reason === 'cancelled';
        setTx({ state: 'pending', hash });
      } });
      if (cancelled || receipt.status !== 'success' || receipt.to?.toLowerCase() !== current.expectedAddress?.toLowerCase()) {
        setTx({ state: 'error', hash: receipt.transactionHash, message: cancelled ? 'Transaksi dibatalkan melalui wallet.' : 'Transaksi gagal di chain. Perbarui data lalu coba lagi.' });
      } else {
        let details;
        try { details = current.decode?.(receipt); }
        catch { details = null; }
        const required = typeof current.requireEvent === 'function' ? current.requireEvent() : current.requireEvent;
        const missing = required && !details;
        setTx({ state: missing ? 'error' : 'success', hash: receipt.transactionHash, message: missing ? 'Receipt sukses, tetapi event aksi ini tidak ditemukan. Periksa transaksi di explorer.' : typeof current.successMessage === 'function' ? current.successMessage(details) : current.successMessage, details });
        try { await onConfirmed?.(details); }
        catch { setTx((previous) => ({ ...previous, warning: 'Transaksi berhasil, tetapi data belum diperbarui. Gunakan Refresh.' })); }
      }
      locked.current = false; onBusy(false);
    } catch {
      setTx({ state: 'unknown', hash, message: 'Transaksi terkirim. RPC belum memberi status; cek explorer atau ulangi pengecekan.' });
    }
  }
  async function run(parameters, options = {}) {
    if (locked.current) return;
    locked.current = true; onBusy(true); context.current = options;
    setTx({ state: 'preparing' });
    try {
      const params = typeof parameters === 'function' ? await parameters() : parameters;
      context.current.expectedAddress = params.address;
      const { request } = await publicClient.simulateContract(params);
      const [gas, gasPrice, balance] = await Promise.all([
        publicClient.estimateContractGas(request), publicClient.getGasPrice(), getEthBalance(params.account),
      ]);
      if ((params.value || 0n) + gas * gasPrice * 120n / 100n > balance) throw Error('INSUFFICIENT_GAS_BALANCE');
      setTx({ state: 'awaiting' });
      const hash = await buyToken(request); // Shared wallet account/network validation for every contract action.
      setTx({ state: 'pending', hash });
      await confirm(hash);
    } catch (error) {
      setTx({ state: 'error', message: translateError(error) });
      locked.current = false; onBusy(false);
    }
  }
  const busy = ['preparing', 'awaiting', 'pending', 'unknown'].includes(tx.state);
  return { tx, busy, run, reset: () => { if (!locked.current) setTx({ state: 'idle' }); }, retryReceipt: () => confirm(tx.hash) };
}
