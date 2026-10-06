import { useEffect, useRef, useState } from 'react';
import { formatUnits, decodeEventLog } from 'viem';
import { publicClient, formatEth, formatTokens, applySlippage } from '../web3/client.js';
import { curveAbi, tokenAbi } from '../web3/abis.js';
import { parseTokenInput, estimateSell } from '../web3/market.js';
import useTransaction from '../hooks/useTransaction.js';
import TransactionNotice from './TransactionNotice.jsx';
export default function SellForm({ token, account, wrongChain, ethBalance, balanceVersion, globalBusy, onBusy, onConfirmed }) {
  const [input, setInput] = useState('');
  const [slippage, setSlippage] = useState(100);
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const identity = `${token.token}:${account}`;
  const identityRef = useRef(identity); identityRef.current = identity;
  const action = useTransaction({ onBusy, onConfirmed: async () => { setRetry((v) => v + 1); await onConfirmed(); } });
  useEffect(() => { if (!action.busy) { setInput(''); action.reset(); } }, [identity]);
  useEffect(() => {
    let cancelled = false; setData(null); setError(false);
    if (account) publicClient.multicall({ allowFailure: true, contracts: [
      { address: token.token, abi: tokenAbi, functionName: 'balanceOf', args: [account] },
      { address: token.token, abi: tokenAbi, functionName: 'allowance', args: [account, token.curve] },
    ] }).then((r) => {
      if (cancelled) return;
      if (r.some((item) => item.status !== 'success')) throw Error('Balance unavailable');
      setData({ identity, balance: r[0].result, allowance: r[1].result });
    }).catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [identity, retry, balanceVersion]);
  const amount = parseTokenInput(input, token.decimals);
  const estimate = amount && token.dataValid ? estimateSell(amount, token) : null;
  const minQuote = estimate ? applySlippage(estimate.quoteOut, slippage) : 0n;
  const needsApproval = Boolean(amount && data && data.allowance < amount);
  const reason = globalBusy && !action.busy ? 'Transaksi lain sedang diproses' : !account ? 'Hubungkan wallet dulu' : wrongChain ? 'Pindah ke Robinhood Testnet'
    : token.phase !== 0 ? 'Curve sudah ditutup' : !token.dataValid ? 'Data token belum tersedia' : !data || data.identity !== identity ? 'Saldo dan allowance belum tersedia'
      : ethBalance === null || ethBalance === 0n ? 'ETH untuk gas belum tersedia' : !amount ? 'Masukkan jumlah token yang valid' : amount > data.balance ? 'Saldo token tidak cukup'
        : minQuote <= 0n ? 'Jumlah jual terlalu kecil' : null;
  async function sellOrApprove() {
    if (reason || action.busy) return;
    const initialIdentity = identity;
    const capturedToken = token;
    let approved = false;
    await action.run(async () => {
      const allowance = await publicClient.readContract({ address: token.token, abi: tokenAbi, functionName: 'allowance', args: [account, token.curve] });
      if (initialIdentity !== identityRef.current) throw Error('ACCOUNT_CHANGED');
      if (allowance < amount) { approved = true; return { address: token.token, abi: tokenAbi, functionName: 'approve', args: [token.curve, amount], account }; }
      return { address: token.curve, abi: curveAbi, functionName: 'sell', args: [amount, minQuote, account], account };
    }, { requireEvent: () => !approved, successMessage: () => approved ? 'Approval berhasil. Tekan Jual token untuk melanjutkan.' : 'Penjualan berhasil.', decode(receipt) {
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== capturedToken.curve.toLowerCase()) continue;
        try { const event = decodeEventLog({ abi: curveAbi, data: log.data, topics: log.topics }); if (event.eventName === 'CurveSell' && event.args.recipient.toLowerCase() === account.toLowerCase()) return { quoteOut: event.args.quoteOut }; } catch { /* Non-sale log. */ }
      }
      return null;
    } });
  }
  return <div className="content-panel sell-panel"><div className="eyebrow">SELL / BONDING CURVE</div><h2>Jual ${token.symbol}</h2><p className="field-hint">Approval jumlah tepat dan penjualan merupakan transaksi terpisah. Estimasi ETH sudah dikurangi fee dan creator tax.</p><div className="balance-strip"><span>Saldo token</span><b>{data ? `${formatTokens(data.balance, token.decimals)} ${token.symbol}` : '—'}</b></div><label className="field"><span>Jumlah token</span><input inputMode="decimal" value={input} onChange={(e) => setInput(e.target.value)} disabled={action.busy} placeholder="0.0" /></label><button className="text-button" disabled={!data || action.busy || data.balance === 0n} onClick={() => setInput(formatUnits(data.balance, token.decimals))}>Gunakan seluruh saldo</button><fieldset className="field slip-field"><legend>Slippage</legend><div className="slip-row">{[50, 100, 500].map((value) => <button className={`slip${slippage === value ? ' on' : ''}`} aria-pressed={slippage === value} disabled={action.busy} key={value} onClick={() => setSlippage(value)}>{value / 100}%</button>)}</div></fieldset>{estimate && <div className="est"><div><span>Perkiraan ETH diterima</span><b>{formatEth(estimate.quoteOut)} ETH</b></div><div><span>Minimum ETH</span><b>{formatEth(minQuote)} ETH</b></div><div><span>Fee + creator tax</span><b>{formatEth(estimate.fee + estimate.tax)} ETH</b></div></div>}{error && <div className="notice error">Gagal membaca saldo/allowance.<button className="text-button" onClick={() => setRetry((v) => v + 1)}>Coba lagi</button></div>}<button className="buybtn" disabled={Boolean(reason) || action.busy} onClick={sellOrApprove}>{action.busy ? 'Transaksi sedang diproses…' : reason || (needsApproval ? '1. Approve jumlah token' : '2. Jual token ↗')}</button><TransactionNotice action={action} />{action.tx.state === 'success' && action.tx.details?.quoteOut !== undefined && <div className="notice">ETH aktual diterima: <b>{formatEth(action.tx.details.quoteOut)} ETH</b></div>}</div>;
}
