import { useEffect, useMemo, useRef, useState } from 'react';
import { parseEthInput, estimateBuy, applySlippage, formatEth, formatTokens, prepareBuy, buyToken, waitBuyReceipt, translateError, txUrl, getTokenBalance, shortAddress } from '../web3/client.js';
const SLIPPAGES = [50, 100, 500];

export default function BuyForm({ token, account, ethBalance, wrongChain, onBought, onBusy, balanceVersion, onRefresh }) {
  const [ethIn, setEthIn] = useState('');
  const [slippage, setSlippage] = useState(100);
  const [tokenBal, setTokenBal] = useState(null);
  const [balanceError, setBalanceError] = useState(false);
  const [balanceRetry, setBalanceRetry] = useState(0);
  const [gasCheck, setGasCheck] = useState({ key: '', state: 'idle' });
  const [gasRetry, setGasRetry] = useState(0);
  const [tx, setTx] = useState({ state: 'idle' });
  const [refreshError, setRefreshError] = useState('');
  const running = useRef(false);
  const identity = useRef('');
  identity.current = `${token.token}:${account}`;
  const busy = ['preparing', 'awaiting', 'pending', 'unknown'].includes(tx.state);

  useEffect(() => {
    if (!running.current) { setEthIn(''); setTx({ state: 'idle' }); setRefreshError(''); }
  }, [token.token, account]);
  useEffect(() => {
    let cancelled = false;
    setTokenBal(null); setBalanceError(false);
    if (account) getTokenBalance(token.token, account)
      .then((value) => { if (!cancelled) setTokenBal(value); })
      .catch(() => { if (!cancelled) setBalanceError(true); });
    return () => { cancelled = true; };
  }, [token.token, account, balanceVersion, balanceRetry]);

  const quoteIn = useMemo(() => parseEthInput(ethIn), [ethIn]);
  const recipientMatches = Boolean(account && token.recipient?.toLowerCase() === account.toLowerCase());
  const est = useMemo(() => quoteIn && token.dataValid && (!account || recipientMatches)
    ? estimateBuy(quoteIn, token.feeBps, token.creatorTaxBps, token.quoteReserve, token.tokenReserve, token.snipeTaxBps) : null,
  [quoteIn, token, recipientMatches]);
  const minOut = est ? applySlippage(est.tokensOut, slippage) : 0n;
  const baseReason = !account ? 'Hubungkan wallet dulu'
    : wrongChain ? 'Pindah ke Robinhood Testnet'
      : !token.dataValid ? 'Data token belum tersedia'
        : !recipientMatches ? 'Perbarui estimasi wallet'
          : token.phase !== 0 ? 'Token tidak dijual di curve'
            : ethBalance === null ? 'Saldo ETH belum tersedia'
              : !quoteIn ? 'Masukkan jumlah ETH yang valid'
                : quoteIn >= ethBalance ? 'Sisakan ETH untuk biaya gas'
                  : !est?.tokensOut || minOut === 0n ? 'Jumlah beli terlalu kecil' : null;

  const gasKey = `${token.token}:${account}:${quoteIn}:${minOut}:${token.blockNumber}:${wrongChain}:${gasRetry}`;
  useEffect(() => {
    if (baseReason || busy) return;
    let cancelled = false;
    setGasCheck({ key: gasKey, state: 'loading' });
    // No wallet prompt: only simulate and estimate through the public RPC.
    const timer = setTimeout(async () => {
      try {
        const { gasCost } = await prepareBuy({ curve: token.curve, quoteIn, minTokensOut: minOut, account });
        if (!cancelled) setGasCheck({ key: gasKey, state: 'ready', gasCost });
      } catch (error) {
        if (!cancelled) setGasCheck({ key: gasKey, state: 'error', message: translateError(error) });
      }
    }, 450);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [baseReason, busy, gasKey, token.curve, quoteIn, minOut, account]);
  const gasReady = gasCheck.key === gasKey && gasCheck.state === 'ready';
  const reason = baseReason || (!gasReady ? gasCheck.key === gasKey && gasCheck.state === 'error' ? 'Periksa transaksi sebelum membeli' : 'Memeriksa saldo dan biaya gas…' : quoteIn + gasCheck.gasCost > ethBalance ? 'Saldo tidak cukup termasuk gas' : null);

  async function confirmPurchase(purchase, initialHash) {
    let hash = initialHash;
    try {
      const { receipt, tokensOut } = await waitBuyReceipt(hash, purchase.token.curve, purchase.account, ({ transactionReceipt }) => {
        hash = transactionReceipt.transactionHash;
        setTx({ state: 'pending', hash, symbol: purchase.token.symbol });
      });
      if (receipt.status !== 'success') {
        setTx({ state: 'error', hash: receipt.transactionHash, message: 'Transaksi gagal di chain. Perbarui data dan periksa harga atau status token.' });
      } else if (tokensOut === null) {
        setTx({ state: 'error', hash: receipt.transactionHash, message: 'Transaksi selesai tanpa event pembelian yang sesuai. Periksa receipt di explorer.' });
      } else {
        setTx({ state: 'success', hash: receipt.transactionHash, tokensOut, symbol: purchase.token.symbol, decimals: purchase.token.decimals });
        try { await onBought(); setBalanceRetry((v) => v + 1); }
        catch { setRefreshError('Pembelian berhasil, tetapi saldo belum diperbarui. Klik Perbarui data.'); }
      }
      running.current = false; onBusy(false);
    } catch {
      // A failed RPC wait does not prove the transaction failed. Keep buying locked.
      setTx({ state: 'unknown', hash, purchase, message: 'Transaksi sudah terkirim, tetapi statusnya belum dapat dibaca. Periksa explorer atau cek status kembali.' });
    }
  }
  async function onBuy() {
    if (reason || running.current) return;
    running.current = true; onBusy(true); setRefreshError('');
    const originalIdentity = identity.current;
    const purchase = { token, account, quoteIn, minTokensOut: minOut };
    setTx({ state: 'preparing', symbol: token.symbol });
    try {
      const { request } = await prepareBuy({ curve: token.curve, quoteIn, minTokensOut: minOut, account });
      if (identity.current !== originalIdentity) throw new Error('ACCOUNT_CHANGED');
      setTx({ state: 'awaiting', symbol: token.symbol });
      const hash = await buyToken(request);
      setTx({ state: 'pending', hash, symbol: token.symbol });
      await confirmPurchase(purchase, hash);
    } catch (error) {
      setTx({ state: 'error', message: translateError(error) });
      running.current = false; onBusy(false);
    }
  }
  async function onCheckReceipt() {
    const { hash, purchase } = tx;
    setTx({ state: 'pending', hash, symbol: purchase.token.symbol });
    await confirmPurchase(purchase, hash);
  }

  return (
    <div className="buyform">
      <div className="trade-tabs"><span className="trade-tab-active">BUY TOKEN</span><span className="trade-network"><i className="network-dot" /> ETH PAIR</span></div>
      <div className="buy-head"><div><h2 className="buy-title">Beli ${token.symbol}</h2><div className="buy-sub">Curve {shortAddress(token.curve)}</div></div><span className="trade-icon" aria-hidden="true">Ξ</span></div>
      <div className="balance-strip"><span>Saldo ETH</span><b>{account ? ethBalance === null ? 'Belum tersedia' : `${formatEth(ethBalance)} ETH` : 'Wallet belum terhubung'}</b></div>
      {account && <div className="bal-row">Saldo ${token.symbol}: <b>{tokenBal === null ? balanceError ? 'Gagal dibaca' : 'Memuat…' : formatTokens(tokenBal, token.decimals)}</b>{balanceError && <button className="text-button" onClick={() => setBalanceRetry((v) => v + 1)}>Coba lagi</button>}</div>}
      <label className="field"><span>Jumlah ETH</span><div className="input-row"><input aria-describedby="amount-hint" inputMode="decimal" autoComplete="off" placeholder="0.01" value={ethIn} onChange={(e) => setEthIn(e.target.value)} disabled={busy} /><span className="input-unit">ETH</span></div></label>
      <p className="field-hint" id="amount-hint">Sisakan saldo untuk gas. Maksimal 18 angka desimal.</p>
      <div className="quick-amounts">{['0.001', '0.005', '0.01'].map((value) => <button key={value} disabled={busy} className="ghost" onClick={() => setEthIn(value)}>{value} ETH</button>)}</div>
      <fieldset className="field slip-field"><legend>Toleransi slippage</legend><div className="slip-row">{SLIPPAGES.map((s) => <button key={s} disabled={busy} aria-pressed={slippage === s} className={`slip${slippage === s ? ' on' : ''}`} onClick={() => setSlippage(s)}>{s / 100}%</button>)}</div></fieldset>
      {est ? <div className="est"><div className="est-main"><span>Perkiraan diterima</span><b>≈ {formatTokens(est.tokensOut, token.decimals)} ${token.symbol}</b></div><div><span>Fee protokol ({Number(token.feeBps) / 100}%)</span><b>{formatEth(est.fee)} ETH</b></div><div><span>Creator tax ({Number(token.creatorTaxBps) / 100}%)</span><b>{formatEth(est.creatorTax)} ETH</b></div>{est.snipeTax > 0n && <div><span>Snipe tax</span><b>{formatEth(est.snipeTax)} ETH</b></div>}<div><span>Minimum estimasi</span><b>{formatTokens(minOut, token.decimals)} ${token.symbol}</b></div><p className="field-hint">Mendekati graduation, kontrak dapat mengisi sebagian pembelian dan mengembalikan sisa ETH. Batas slippage berlaku pada harga.</p></div>
        : <div className="estimate-empty">Masukkan jumlah untuk melihat estimasi dan biaya.</div>}
      {(!token.dataValid || (account && !recipientMatches)) && <div className="notice"><span>Perbarui data sebelum membeli.</span><button className="text-button" disabled={busy} onClick={onRefresh}>Perbarui data</button></div>}
      {!baseReason && gasCheck.key === gasKey && gasCheck.state === 'ready' && <div className="field-hint">Estimasi gas dengan cadangan 20%: {formatEth(gasCheck.gasCost)} ETH</div>}
      {!baseReason && gasCheck.key === gasKey && gasCheck.state === 'error' && !busy && <div className="notice error" role="alert">{gasCheck.message}<button className="text-button" onClick={() => { setGasRetry((v) => v + 1); onRefresh(); }}>Periksa ulang</button></div>}
      <button className="buybtn" disabled={Boolean(reason) || busy} onClick={onBuy}>{tx.state === 'preparing' ? 'Memeriksa transaksi…' : tx.state === 'awaiting' ? 'Konfirmasi di wallet…' : tx.state === 'pending' ? 'Menunggu masuk blok…' : tx.state === 'unknown' ? 'Status transaksi belum tersedia' : reason || `Beli $${token.symbol}`}</button>
      <div aria-live="polite">{tx.state === 'pending' && <div className="txbox pending"><div className="state-title">Transaksi terkirim</div>Menunggu konfirmasi chain.<br /><a href={txUrl(tx.hash)} target="_blank" rel="noreferrer">Lihat transaksi ↗</a></div>}{tx.state === 'success' && <div className="txbox success"><div className="state-title">Pembelian berhasil</div>Kamu menerima <b>{formatTokens(tx.tokensOut, tx.decimals)} ${tx.symbol}</b>.<br /><a href={txUrl(tx.hash)} target="_blank" rel="noreferrer">Lihat transaksi ↗</a></div>}{tx.state === 'error' && <div className="txbox error">{tx.message}{tx.hash && <><br /><a href={txUrl(tx.hash)} target="_blank" rel="noreferrer">Periksa transaksi ↗</a></>}</div>}</div>
      {tx.state === 'unknown' && <div className="txbox pending" role="status">{tx.message}<br /><a href={txUrl(tx.hash)} target="_blank" rel="noreferrer">Periksa transaksi ↗</a><br /><button className="text-button" onClick={onCheckReceipt}>Cek status kembali</button></div>}
      {refreshError && <div className="notice" role="status">{refreshError}<button className="text-button" onClick={async () => { try { await onBought(); setBalanceRetry((v) => v + 1); setRefreshError(''); } catch { setRefreshError('Data belum dapat diperbarui. Coba lagi setelah koneksi pulih.'); } }}>Perbarui data</button></div>}
    </div>
  );
}
