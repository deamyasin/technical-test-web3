import { useEffect, useState } from 'react';
import { bytesToHex, decodeEventLog, parseUnits } from 'viem';
import { FACTORY, ZERO_ADDRESS, EXPLORER } from '../web3/chain.js';
import { factoryAbi } from '../web3/abis.js';
import { publicClient, formatEth, shortAddress } from '../web3/client.js';
import useTransaction from '../hooks/useTransaction.js';
import TransactionNotice from './TransactionNotice.jsx';
import { safeExternalUrl } from '../web3/market.js';
const launchAbi = factoryAbi.filter((item) => item.name !== 'launchToken' || item.inputs.length === 3);
export default function LaunchPage({ active, account, wrongChain, ethBalance, globalBusy, onBusy, onConfirmed, onConnect, walletBusy, onOpenToken }) {
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('TEST');
  const [description, setDescription] = useState('');
  const [logo, setLogo] = useState('');
  const [website, setWebsite] = useState('');
  const [tax, setTax] = useState('0');
  const [buyback, setBuyback] = useState(false);
  const [permission, setPermission] = useState(null);
  const [fee, setFee] = useState(null);
  const [readError, setReadError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    setPermission(null); setReadError(false);
    Promise.all([
      publicClient.readContract({ address: FACTORY, abi: factoryAbi, functionName: 'launchFee' }),
      account ? publicClient.readContract({ address: FACTORY, abi: factoryAbi, functionName: 'canLaunch', args: [account] }) : Promise.resolve(null),
    ]).then(([fee, allowed]) => { if (!cancelled) { setFee(fee); setPermission(allowed); } })
      .catch(() => { if (!cancelled) setReadError(true); });
    return () => { cancelled = true; };
  }, [active, account, retry]);
  const action = useTransaction({ onBusy, onConfirmed });
  let taxBps = null;
  if (/^\d+(?:\.\d{1,2})?$/.test(tax) && Number(tax) <= 10) taxBps = parseUnits(tax, 2);
  const bytes = (value) => new TextEncoder().encode(value).length;
  const reason = globalBusy && !action.busy ? 'Transaksi lain sedang diproses' : !account ? 'Hubungkan wallet dulu' : wrongChain ? 'Pindah ke Robinhood Testnet'
    : readError ? 'Data launch belum tersedia' : permission === null ? 'Memeriksa izin launch…' : !permission ? 'Wallet belum diizinkan launch'
      : !name.trim() || bytes(name.trim()) > 64 ? 'Nama wajib diisi, maksimal 64 byte' : !symbol.trim() || bytes(symbol.trim()) > 16 ? 'Ticker wajib diisi, maksimal 16 byte'
        : taxBps === null ? 'Creator tax harus 0–10%, maksimal 2 desimal' : logo && !safeExternalUrl(logo) ? 'URL logo harus http/https'
          : website && !safeExternalUrl(website) ? 'URL website harus http/https' : fee === null || ethBalance === null ? 'Saldo dan fee belum tersedia'
            : ethBalance <= fee ? 'Saldo tidak cukup untuk launch dan gas' : null;
  async function launch() {
    if (reason || action.busy) return;
    await action.run(async () => {
      const [allowed, currentFee, expectedEconomics] = await Promise.all([
        publicClient.readContract({ address: FACTORY, abi: factoryAbi, functionName: 'canLaunch', args: [account] }),
        publicClient.readContract({ address: FACTORY, abi: factoryAbi, functionName: 'launchFee' }),
        publicClient.readContract({ address: FACTORY, abi: factoryAbi, functionName: 'previewLaunchEconomics', args: [1n, ZERO_ADDRESS] }),
      ]);
      if (!allowed) throw Error('LAUNCH_NOT_ALLOWED');
      const params = { name: name.trim(), symbol: symbol.trim(), logo: logo.trim(), description: description.trim(),
        socials: { twitter: '', telegram: '', discord: '', website: website.trim(), farcaster: '' },
        creatorFeeRecipient: ZERO_ADDRESS, creatorTaxBps: Number(taxBps), buybackEnabled: buyback,
        expectedEconomics, salt: bytesToHex(crypto.getRandomValues(new Uint8Array(32))),
      };
      return { address: FACTORY, abi: launchAbi, functionName: 'launchToken', args: [params, 1n, ZERO_ADDRESS], value: currentFee, account };
    }, { requireEvent: true, successMessage: 'Token berhasil diluncurkan. Daftar token diperbarui otomatis.', decode(receipt) {
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== FACTORY.toLowerCase()) continue;
        try { const event = decodeEventLog({ abi: factoryAbi, data: log.data, topics: log.topics }); if (event.eventName === 'TokenLaunched') return event.args; } catch { /* Other factory events. */ }
      }
      return null;
    } });
  }
  return <section className="page-shell"><div className="eyebrow">CREATE / ONCHAIN LAUNCH</div><h1>Launch your<br /><span>next idea.</span></h1><p className="page-lead">Buat token di Robinhood Testnet. Mulai di bonding curve, lalu graduate ke pool v4.</p>
    <div className="page-columns"><div className="content-panel launch-fields"><h2>Token identity</h2><label className="field"><span>Nama token · gunakan nama lengkap untuk bonus tes</span><input value={name} onChange={(e) => setName(e.target.value)} maxLength={64} disabled={action.busy} placeholder="Nama Lengkap Kamu" /></label><label className="field"><span>Ticker</span><input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} maxLength={16} disabled={action.busy} placeholder="TEST" /></label><label className="field"><span>Deskripsi</span><textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} disabled={action.busy} placeholder="Ceritakan ide di balik token ini…" /></label><label className="field"><span>Logo URL · opsional</span><input type="url" value={logo} onChange={(e) => setLogo(e.target.value)} disabled={action.busy} placeholder="https://…" /></label><label className="field"><span>Website · opsional</span><input type="url" value={website} onChange={(e) => setWebsite(e.target.value)} disabled={action.busy} placeholder="https://…" /></label><div className="field-pair"><label className="field"><span>Creator tax % · 0 sampai 10</span><input inputMode="decimal" value={tax} onChange={(e) => setTax(e.target.value)} disabled={action.busy} /></label><label className="checkbox-field"><input type="checkbox" checked={buyback} onChange={(e) => setBuyback(e.target.checked)} disabled={action.busy} /><span>Creator buyback</span></label></div></div>
      <aside className="content-panel launch-summary"><div className="eyebrow">LAUNCH SUMMARY</div><h2>${symbol || 'TOKEN'}</h2><dl><div><dt>Pair</dt><dd>ETH</dd></div><div><dt>Launch config</dt><dd>1 · target 0.042 ETH</dd></div><div><dt>Launch fee</dt><dd>{fee === null ? '—' : `${formatEth(fee)} ETH`}</dd></div><div><dt>Creator tax</dt><dd>{tax}%</dd></div><div><dt>Wallet</dt><dd>{account ? shortAddress(account) : 'Belum terhubung'}</dd></div></dl><p className="field-hint">Fee dibaca ulang sebelum transaksi. Gas terpisah. Recipient creator fee memakai wallet pengirim; salt baru pada setiap percobaan.</p>{permission === false && <div className="notice">Wallet belum diizinkan. Berikan alamat wallet ke pengawas untuk akses canLaunch.</div>}{readError && <button className="text-button" onClick={() => setRetry((v) => v + 1)}>Coba baca fee dan izin lagi</button>}{!account ? <button className="connect" disabled={walletBusy || globalBusy} onClick={onConnect}>Connect Wallet</button> : <button className="buybtn" disabled={Boolean(reason) || action.busy} onClick={launch}>{action.busy ? 'Transaksi sedang diproses…' : reason || 'Launch token ↗'}</button>}<TransactionNotice action={action} />{action.tx.state === 'success' && action.tx.details && <div className="notice"><a className="addr" href={`${EXPLORER}/address/${action.tx.details.token}`} target="_blank" rel="noreferrer">{shortAddress(action.tx.details.token)} ↗</a><button className="text-button" onClick={() => onOpenToken(action.tx.details.token)}>Lihat token baru ↗</button></div>}</aside>
    </div></section>;
}
