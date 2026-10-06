import { useEffect, useState } from 'react';
import { fetchMarketActivity } from '../web3/market.js';
import { formatEth, formatTokens, shortAddress, txUrl } from '../web3/client.js';
export default function ActivityPage({ active, tokens, tokensState, onOpenToken, globalBusy, onlyToken = false }) {
  const [entries, setEntries] = useState([]);
  const [state, setState] = useState('idle');
  const [retry, setRetry] = useState(0);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(20);
  const snapshot = tokens.map((token) => `${token.token}:${token.blockNumber}`).join(',');
  useEffect(() => {
    if (!active || tokensState !== 'ready') return;
    let cancelled = false; setState('loading');
    fetchMarketActivity(tokens).then((data) => { if (!cancelled) { setEntries(data); setState('ready'); } })
      .catch(() => { if (!cancelled) setState('error'); });
    return () => { cancelled = true; };
  }, [active, tokensState, snapshot, retry]);
  useEffect(() => { setLimit(20); }, [filter, search]);
  const known = new Set(tokens.map((token) => token.token.toLowerCase()));
  const visible = entries.filter((entry) => known.has(entry.token.token.toLowerCase()) && (filter === 'all' || entry.kind === filter)
    && `${entry.token.name} ${entry.token.symbol} ${entry.hash} ${entry.recipient} ${entry.buyer || entry.seller}`.toLowerCase().includes(search.toLowerCase().trim()));
  return <section className={onlyToken ? 'token-activity' : 'page-shell'}>{!onlyToken && <><div className="eyebrow">MARKET / ONCHAIN FEED</div><h1>Follow the<br /><span>flow.</span></h1><p className="page-lead">Pembelian dan penjualan curve, langsung dari event kontrak. Tidak ada volume atau aktivitas buatan.</p></>}<div className="pane-head"><h2>{onlyToken ? 'Token activity' : 'Recent activity'} <span className="count">{visible.length}</span></h2><button className="ghost" disabled={state === 'loading'} onClick={() => setRetry((v) => v + 1)}>↻ Refresh</button></div><div className="activity-controls"><div className="filter-tabs">{[['all', 'All'], ['buy', 'Buy'], ['sell', 'Sell']].map(([value, label]) => <button key={value} className={filter === value ? 'on' : ''} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div><input className="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari token, wallet, atau transaksi…" aria-label="Cari aktivitas" /></div>{tokensState !== 'ready' && <div className="notice">Menunggu daftar token. Gunakan Refresh di Explore jika discovery gagal.</div>}{state === 'loading' && <div className="notice" role="status">Memperbarui event dalam potongan maksimal 50.000 blok…</div>}{state === 'error' && <div className="notice error" role="alert">Aktivitas belum dapat diperbarui.<button className="text-button" onClick={() => setRetry((v) => v + 1)}>Coba lagi</button></div>}{state === 'ready' && !visible.length && <div className="state"><div className="state-title">Belum ada aktivitas yang cocok</div><p className="state-sub">Coba filter lain atau tunggu transaksi curve berikutnya.</p></div>}<div className="history-list">{visible.slice(0, limit).map((entry) => <article className="history-row" key={`${entry.hash}:${entry.logIndex}`}><div className={`history-kind ${entry.kind}`}>{entry.kind === 'buy' ? '↙' : '↗'}</div><div><button className="text-button" disabled={globalBusy} onClick={() => onOpenToken(entry.token.token)}>${entry.token.symbol}</button><p>{entry.kind.toUpperCase()} · {shortAddress(entry.buyer || entry.seller)} · block {entry.blockNumber.toString()}</p></div><div className="history-amount"><b>{formatTokens(entry.kind === 'buy' ? entry.tokensOut : entry.tokensIn, entry.token.decimals)} {entry.token.symbol}</b><span>{formatEth(entry.kind === 'buy' ? entry.quoteIn : entry.quoteOut)} ETH</span></div><a className="addr" href={txUrl(entry.hash)} target="_blank" rel="noreferrer">TX ↗</a></article>)}</div>{visible.length > limit && <button className="ghost load-more" onClick={() => setLimit((n) => n + 20)}>Muat 20 transaksi berikutnya</button>}<p className="field-hint">Hanya event bonding curve pair ETH factory ini. Transaksi pool v4 dan transfer ERC-20 tidak dihitung sebagai aktivitas curve.</p></section>;
}
