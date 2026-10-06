import { useState } from 'react';
import { PHASE_LABEL } from '../web3/chain.js';
import { formatPrice, formatProgress, formatEth, shortAddress, EXPLORER } from '../web3/client.js';
function Logo({ token }) {
  const [failed, setFailed] = useState(false);
  return !token.logo || failed ? <div className="logo-ph" aria-hidden="true">{(token.symbol || '?').slice(0, 2)}</div>
    : <img className="logo-img" src={token.logo} alt="" onError={() => setFailed(true)} loading="lazy" />;
}
export default function TokenCard({ token, selected, disabled, onSelect }) {
  const pct = Number(token.progressBps) / 100;
  return (
    <article className={`card${selected ? ' selected' : ''}`}>
      <button className="card-select" disabled={disabled} aria-pressed={selected} aria-label={`Pilih ${token.name}`} onClick={() => onSelect(token)}>
        <div className="card-top"><Logo key={token.logo} token={token} /><div className="card-id"><div className="card-name">{token.name}</div><div className="card-sym">${token.symbol}</div></div><span className={`phase p${token.phase}`}>{PHASE_LABEL[token.phase] ?? 'Data tidak tersedia'}</span></div>
        <div className="card-mid"><div><div className="metric-label">HARGA SPOT</div><div className="price">{token.dataValid ? formatPrice(token.priceWad, token.priceDecimals) : '—'} <span>ETH</span></div></div><div className="raised"><div className="metric-label">TERKUMPUL / TARGET</div>{token.dataValid ? `${formatEth(token.realQuoteReserve)} / ${formatEth(token.graduationThreshold)} ETH` : 'Data belum tersedia'}</div></div>
        <div className="bar" role="progressbar" aria-label="Progres graduation" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><div className="bar-fill" style={{ width: `${pct}%` }} /></div><div className="bar-label"><span>Menuju graduation</span><b>{token.dataValid ? formatProgress(token.progressBps) : '—'}</b></div>
      </button>
      <div className="card-bottom"><a className="addr" href={`${EXPLORER}/address/${token.token}`} target="_blank" rel="noreferrer">{shortAddress(token.token)} ↗</a><span>{!token.dataValid ? 'Perbarui data untuk membeli' : token.phase === 0 ? 'Bisa dibeli' : 'Pembelian curve ditutup'}</span></div>
    </article>
  );
}
