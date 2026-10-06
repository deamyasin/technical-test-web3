import { useEffect, useRef, useState } from 'react';
import { formatUnits } from 'viem';
import { fetchWalletPortfolio } from '../web3/portfolio.js';
import { formatEth, formatTokens, shortAddress, txUrl, EXPLORER } from '../web3/client.js';
import { PHASE_LABEL } from '../web3/chain.js';

export default function WalletProfile({ active, account, ethBalance, tokens, tokensState, balanceVersion, onConnect, walletBusy, onTrade }) {
  const [result, setResult] = useState(null);
  const [state, setState] = useState('idle');
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const version = useRef(0);
  const snapshot = tokens.map((token) => `${token.token}:${token.blockNumber}`).join(',');
  useEffect(() => {
    const current = ++version.current;
    if (!active || !account || tokensState !== 'ready') return;
    setState('loading'); setError('');
    fetchWalletPortfolio(tokens, account).then((data) => {
      if (current !== version.current) return;
      setResult({ ...data, account }); setState('ready');
    }).catch(() => {
      if (current !== version.current) return;
      setError('Saldo dan riwayat belum dapat dibaca dari chain. Coba lagi.'); setState('error');
    });
    return () => { ++version.current; };
  }, [active, account, tokensState, snapshot, balanceVersion, retry]);
  useEffect(() => { setResult(null); setCopied(false); }, [account]);

  const data = result?.account === account ? result : null;
  const purchasedAddresses = new Set(data?.purchases.map((purchase) => purchase.token.token.toLowerCase()) || []);
  const holdings = data?.holdings.filter(({ token, balance }) => balance === null || balance > 0n || purchasedAddresses.has(token.token.toLowerCase())) || [];
  const positiveCount = data?.holdings.filter(({ balance }) => balance !== null && balance > 0n).length || 0;
  const spent = data?.purchases.reduce((total, purchase) => purchase.buyer.toLowerCase() === account.toLowerCase() ? total + purchase.quoteIn : total, 0n) || 0n;
  async function copyAddress() {
    try { await navigator.clipboard.writeText(account); setCopied(true); }
    catch { setCopied(false); }
  }
  if (!account) return <section className="profile-page"><div className="eyebrow">YOUR ONCHAIN IDENTITY</div><h1>My wallet<span className="brand-period">.</span></h1><div className="profile-connect state"><div className="state-title">Portofolio dimulai dari wallet kamu.</div><p className="state-sub">Hubungkan MetaMask untuk melihat token yang dimiliki dan riwayat pembelian. Tidak perlu membuat akun atau password.</p><button className="connect" disabled={walletBusy} onClick={onConnect}>{walletBusy ? 'Konfirmasi di wallet…' : 'Connect Wallet ↗'}</button></div></section>;
  return (
    <section className="profile-page">
      <div className="profile-heading"><div><div className="eyebrow">YOUR ONCHAIN IDENTITY</div><h1>My wallet<span className="brand-period">.</span></h1></div><button className="ghost" disabled={state === 'loading'} onClick={() => setRetry((v) => v + 1)}>{state === 'loading' ? 'Memperbarui…' : '↻ Refresh wallet'}</button></div>
      <div className="profile-address"><div className="wallet-avatar" aria-hidden="true">{account.slice(2, 4).toUpperCase()}</div><div><b>{shortAddress(account)}</b><p title={account}>{account}</p></div><button className="ghost" onClick={copyAddress}>{copied ? 'Tersalin ✓' : 'Salin alamat'}</button><a className="addr" href={`${EXPLORER}/address/${account}`} target="_blank" rel="noreferrer">Explorer ↗</a></div>
      <div className="market-strip profile-stats"><div><span className="metric-label">WALLET BALANCE</span><b>{ethBalance === null ? '—' : formatEth(ethBalance)}<small>ETH</small></b></div><div><span className="metric-label">TOKENS HELD</span><b>{data ? positiveCount : '—'}<small>token</small></b></div><div><span className="metric-label">CURVE PURCHASES</span><b>{data ? data.purchases.length : '—'}<small>event</small></b></div><div><span className="metric-label">ETH SPENT BY YOU</span><b>{data ? formatEth(spent) : '—'}<small>ETH</small></b></div></div>
      <p className="profile-scope">Portofolio token pair ETH dari factory ini. Saldo dibaca langsung dari kontrak; riwayat mencatat pembelian curve dengan wallet ini sebagai penerima. ETH spent hanya menghitung pembelian oleh wallet kamu, tanpa gas.</p>
      {tokensState !== 'ready' && <div className="notice">Daftar token belum tersedia. Buka Explore dan perbarui data untuk memuat portofolio.</div>}
      {state === 'loading' && <div className="notice" role="status">{data ? 'Memperbarui saldo dan riwayat…' : 'Membaca saldo dan memindai event pembelian secara bertahap…'}</div>}
      {error && <div className="notice error" role="alert">{error}<button className="text-button" onClick={() => setRetry((v) => v + 1)}>Coba lagi</button></div>}
      {data?.partial && <div className="notice error">Sebagian saldo gagal dibaca; nilai tersebut ditampilkan sebagai tidak tersedia.<button className="text-button" onClick={() => setRetry((v) => v + 1)}>Coba lagi</button></div>}
      {data && <><div className="pane-head"><h2>My tokens <span className="count">{holdings.length}</span></h2><p className="section-sub">Saldo saat ini dan token yang pernah dibeli</p></div>
        {!holdings.length ? <div className="state"><div className="state-title">Belum ada token di wallet ini</div><p className="state-sub">Token yang dibeli atau diterima akan muncul di sini.</p><button className="connect" onClick={() => onTrade()}>Explore tokens ↗</button></div> : <div className="holdings-grid">{holdings.map(({ token, balance }) => <article className="holding-card" key={token.token}><div><h3>{token.name}</h3><span className="card-sym">${token.symbol}</span></div><span className={`phase p${token.phase}`}>{PHASE_LABEL[token.phase] || 'Tidak tersedia'}</span><div className="holding-balance"><span className="metric-label">CURRENT BALANCE</span><b title={balance === null ? '' : formatUnits(balance, token.decimals)}>{balance === null ? 'Tidak tersedia' : formatTokens(balance, token.decimals)}</b><small>${token.symbol}</small></div><div className="holding-footer"><a className="addr" href={`${EXPLORER}/address/${token.token}`} target="_blank" rel="noreferrer">{shortAddress(token.token)} ↗</a><button className="text-button" onClick={() => onTrade(token)}>Lihat token ↗</button></div></article>)}</div>}
        <div className="pane-head history-heading"><h2>Trade history <span className="count">{data.activities.length}</span></h2><span className="section-sub">Output aktual dari CurveBuy / CurveSell</span></div>
        {!data.activities.length ? <div className="state"><div className="state-title">Belum ada transaksi curve</div><p className="state-sub">Saldo dari transfer atau pool v4 dapat tetap muncul di My tokens.</p></div> : <div className="history-list">{data.activities.map((purchase) => <article className="history-row" key={`${purchase.hash}:${purchase.logIndex}`}><div className={`history-kind ${purchase.kind}`}>{purchase.kind === 'buy' ? '↙' : '↗'}</div><div><b>${purchase.token.symbol}</b><p>{purchase.kind === 'sell' ? 'Penjualan kamu' : purchase.buyer.toLowerCase() === account.toLowerCase() ? 'Pembelian kamu' : `Diterima dari ${shortAddress(purchase.buyer)}`} · block {purchase.blockNumber.toString()}</p></div><div className="history-amount"><b title={formatUnits(purchase.kind === 'buy' ? purchase.tokensOut : purchase.tokensIn, purchase.token.decimals)}>{purchase.kind === 'buy' ? '+' : '−'}{formatTokens(purchase.kind === 'buy' ? purchase.tokensOut : purchase.tokensIn, purchase.token.decimals)}</b><span>{formatEth(purchase.kind === 'buy' ? purchase.quoteIn : purchase.quoteOut)} ETH</span></div><a className="addr" href={txUrl(purchase.hash)} target="_blank" rel="noreferrer" aria-label={`Lihat transaksi ${purchase.hash}`}>TX ↗</a></article>)}</div>}
        <p className="updated">Snapshot block {data.latestBlock.toString()} · pembelian lama tetap terbaca setelah reload</p>
      </>}
    </section>
  );
}
