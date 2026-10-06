import { useAccount, useConnections, useDisconnect } from 'wagmi';
import { useConnectModal, useAccountModal } from '@rainbow-me/rainbowkit';
import { walletConnectEnabled } from './web3/wallet.js';
import { useCallback, useEffect, useRef, useState } from 'react';
import TokenCard from './components/TokenCard.jsx';
import BuyForm from './components/BuyForm.jsx';
import CurveArtwork from './components/CurveArtwork.jsx';
import WalletProfile from './components/WalletProfile.jsx';
import LaunchPage from './components/LaunchPage.jsx';
import ActivityPage from './components/ActivityPage.jsx';
import TokenDetail from './components/TokenDetail.jsx';
import GuidePage from './components/GuidePage.jsx';
import useRoute from './hooks/useRoute.js';
import { publicClient, ensureCorrectChain, getEthBalance, fetchTokenLaunches, fetchTokensData, formatEth, shortAddress, CHAIN_ID, translateError } from './web3/client.js';
import { FACTORY, ZERO_ADDRESS } from './web3/chain.js';
import { factoryAbi } from './web3/abis.js';

function sortTokens(data) {
  return data.sort((a, b) => (a.phase === 0 ? 0 : 1) - (b.phase === 0 ? 0 : 1)
    || (a.progressBps === b.progressBps ? 0 : a.progressBps > b.progressBps ? -1 : 1));
}
export default function App() {
  const { address, chainId, status } = useAccount();
  const account = address || null;
  const connections = useConnections();
  const { disconnectAsync, isPending: disconnecting } = useDisconnect();
  const { openConnectModal } = useConnectModal();
  const { openAccountModal } = useAccountModal();
  const { route, navigate } = useRoute();
  const profileOpen = route.page === 'wallet';
  const setProfileOpen = (open) => navigate(open ? 'wallet' : 'explore');
  const detailAddress = useRef(null);
  const [sort, setSort] = useState('progress');
  const [phaseFilter, setPhaseFilter] = useState('all');
  const [ethBalance, setEthBalance] = useState(null);
  const wrongChain = Boolean(account && chainId !== CHAIN_ID);
  const [switchingChain, setSwitchingChain] = useState(false);
  const walletBusy = disconnecting || switchingChain || status === 'connecting' || status === 'reconnecting';
  const [walletError, setWalletError] = useState('');
  const [launchFee, setLaunchFee] = useState(null);
  const [feeError, setFeeError] = useState(false);
  const [tokens, setTokens] = useState([]);
  const [listState, setListState] = useState('loading');
  const [listError, setListError] = useState('');
  const [selected, setSelected] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [search, setSearch] = useState('');
  const [txBusy, setTxBusy] = useState(false);
  const [balanceVersion, setBalanceVersion] = useState(0);
  const launchesRef = useRef([]);
  const lastBlockRef = useRef(null);
  const loadingRef = useRef(false);
  const completionRef = useRef(Promise.resolve());
  const accountRef = useRef(null);
  const walletVersion = useRef(0);
  const mounted = useRef(true);

  const syncWallet = useCallback(async (address) => {
    const version = ++walletVersion.current;
    const changed = accountRef.current?.toLowerCase() !== address?.toLowerCase();
    accountRef.current = address || null;
    if (changed || !address) setEthBalance(null);
    setWalletError('');
    if (!address) return true;
    try {
      const balance = await getEthBalance(address);
      if (version === walletVersion.current && mounted.current) { setEthBalance(balance); return true; }
    } catch (error) {
      if (version === walletVersion.current && mounted.current) { setEthBalance(null); setWalletError(translateError(error)); }
      return false;
    }
  }, []);

  const refreshList = useCallback(async (full = false) => {
    if (loadingRef.current) {
      await completionRef.current;
      if (!mounted.current) return;
      return refreshList(full);
    }
    loadingRef.current = true;
    let complete;
    completionRef.current = new Promise((resolve) => { complete = resolve; });
    setRefreshing(true);
    setListError('');
    const recipient = accountRef.current || ZERO_ADDRESS;
    try {
      const { launches, latestBlock } = await fetchTokenLaunches(full || lastBlockRef.current === null ? undefined : lastBlockRef.current + 1n);
      const merged = new Map((full ? [] : launchesRef.current).map((l) => [l.token.toLowerCase(), l]));
      launches.forEach((l) => merged.set(l.token.toLowerCase(), l));
      const discovered = [...merged.values()];
      const data = await fetchTokensData(discovered, recipient);
      if (!mounted.current) return;
      launchesRef.current = discovered;
      lastBlockRef.current = latestBlock;
      // An account switch invalidates recipient-specific tax; the next refresh reads it again.
      setTokens(sortTokens(data));
      setSelected((previous) => data.some((t) => t.token === previous) ? previous : data[0]?.token || null);
      setListState('ready');
      setUpdatedAt(new Date());
      return data.every((token) => token.dataValid);
    } catch {
      if (mounted.current) {
        setListError('Data chain belum dapat diperbarui. Periksa koneksi lalu coba lagi.');
        if (!launchesRef.current.length) setListState('error');
        else setTokens((previous) => previous.map((t) => ({ ...t, dataValid: false })));
      }
      return false;
    } finally {
      loadingRef.current = false;
      complete();
      if (mounted.current) setRefreshing(false);
    }
  }, []);

  const readFee = useCallback(async () => {
    setFeeError(false);
    try {
      const fee = await publicClient.readContract({ address: FACTORY, abi: factoryAbi, functionName: 'launchFee' });
      if (mounted.current) setLaunchFee(fee);
    } catch { if (mounted.current) setFeeError(true); }
  }, []);

  useEffect(() => {
    mounted.current = true;
    refreshList(); readFee();
    const id = setInterval(() => { if (!loadingRef.current) refreshList(); if (accountRef.current) syncWallet(accountRef.current); }, 20000);
    return () => { mounted.current = false; clearInterval(id); };
  }, [refreshList, readFee, syncWallet]);

  useEffect(() => { syncWallet(account); }, [account, chainId, syncWallet]);

  useEffect(() => { if (account || lastBlockRef.current !== null) refreshList(); }, [account, refreshList]);

  function onConnect() {
    setWalletError('');
    openConnectModal?.();
  }
  async function onDisconnect() {
    setWalletError('');
    try {
      // Reconnect can authorize injected and EIP-6963 connectors for the same wallet.
      for (const { connector } of connections) await disconnectAsync({ connector });
    } catch (error) { setWalletError(translateError(error)); }
  }
  async function onSwitchChain() {
    setSwitchingChain(true); setWalletError('');
    try { await ensureCorrectChain(); await syncWallet(accountRef.current); }
    catch (error) { setWalletError(translateError(error)); }
    finally { setSwitchingChain(false); }
  }
  async function onBought() {
    setBalanceVersion((v) => v + 1);
    const results = await Promise.all([refreshList(), accountRef.current ? syncWallet(accountRef.current) : Promise.resolve(true)]);
    if (results.some((result) => result === false)) throw new Error('REFRESH_FAILED');
  }
  const activeCount = tokens.filter((token) => token.dataValid && token.phase === 0).length;
  const graduatedCount = tokens.filter((token) => token.dataValid && token.phase === 2).length;
  const selectedToken = tokens.find((t) => t.token === selected);
  const filtered = tokens.filter((t) => `${t.name} ${t.symbol} ${t.token}`.toLowerCase().includes(search.toLowerCase().trim()) && (phaseFilter === 'all' || t.phase === Number(phaseFilter)));
  if (sort === 'newest') filtered.sort((a, b) => a.blockNumber === b.blockNumber ? 0 : a.blockNumber > b.blockNumber ? -1 : 1);
  if (sort === 'name') filtered.sort((a, b) => a.name.localeCompare(b.name));
  if (route.page === 'token' && !txBusy) detailAddress.current = route.address;
  const detailToken = tokens.find((token) => token.token.toLowerCase() === detailAddress.current?.toLowerCase());
  const openToken = (address) => { if (!txBusy) { setSelected(address); navigate('token', address); } };
  const showBuy = (token) => { if (!txBusy) { setSelected(token.token); navigate('explore'); setTimeout(() => document.getElementById('trade')?.scrollIntoView({ behavior: 'auto', block: 'start' }), 0); } };
  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="#" onClick={() => setProfileOpen(false)} aria-label="Launchpad beranda"><div className="brand-name"><span className="brand-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="m12 2 9 5-9 5-9-5 9-5Zm-9 10 9 5 9-5M3 17l9 5 9-5" stroke="currentColor" strokeWidth="2" /></svg></span>launchpad<span className="brand-period">.</span></div></a>
        <nav className="main-nav" aria-label="Navigasi utama">{[['explore', 'Explore'], ['wallet', 'My wallet'], ['launch', 'Create'], ['activity', 'Activity'], ['guide', 'Guide']].map(([page, label]) => <a key={page} className={route.page === page ? 'nav-active' : ''} href={`#/${page}`}>{label}</a>)}</nav>
        <div className="network-badge"><span className="network-dot" /> Robinhood <span className="testnet-tag">TESTNET</span></div>
        {account ? <div className="wallet"><div><button className="text-button w-addr" disabled={txBusy} onClick={openAccountModal} aria-label="Kelola wallet">{shortAddress(account)}</button><div className="w-bal">{ethBalance === null ? 'Memuat saldo…' : `${formatEth(ethBalance)} ETH`}</div></div><button className="ghost" disabled={txBusy || disconnecting} onClick={onDisconnect}>{disconnecting ? 'Disconnecting…' : 'Disconnect'}</button></div>
          : <button className="connect" disabled={walletBusy} onClick={onConnect}>{walletBusy ? 'Menghubungkan wallet…' : 'Connect Wallet'}</button>}
      </header>
      <section className="intro" hidden={route.page !== 'explore'}>
        <div className="intro-copy"><div className="eyebrow"><span className="eyebrow-line" /> ONCHAIN DISCOVERY / 46630</div><h1>Before the<br /><span>breakout.</span><span className="hero-star" aria-hidden="true">✳</span></h1><p>Temukan token sejak awal. Pilih curve kamu,<br className="desktop-break" /> lalu ikuti perjalanan menuju graduation.</p><a className="hero-link" href="#/explore" onClick={(event) => { event.preventDefault(); document.getElementById('explore')?.scrollIntoView({ behavior: 'smooth' }); }}>Jelajahi token <span>↗</span></a></div>
        <CurveArtwork />
      </section>
      <div className="market-strip" hidden={route.page !== 'explore'}><div><span className="metric-label">DISCOVERED</span><b>{listState === 'loading' ? '—' : String(tokens.length).padStart(2, '0')}<small>token</small></b></div><div><span className="metric-label">ON THE CURVE</span><b>{listState === 'loading' ? '—' : String(activeCount).padStart(2, '0')}<small>aktif</small></b></div><div><span className="metric-label">GRADUATED</span><b>{listState === 'loading' ? '—' : String(graduatedCount).padStart(2, '0')}<small>pool v4</small></b></div><div className="fee-stat"><span className="metric-label">FACTORY LAUNCH FEE</span><b>{launchFee === null ? '—' : formatEth(launchFee)}<small>ETH</small></b>{feeError && <button className="text-button" onClick={readFee}>Coba lagi</button>}</div><span className="data-status"><span className="network-dot" /> {listError ? 'UPDATE DELAYED' : refreshing ? 'SYNCING CHAIN' : 'ONCHAIN DATA'}</span></div>
      {!walletConnectEnabled && <div className="notice">Koneksi aplikasi wallet via WalletConnect belum aktif. Gunakan extension atau buka situs ini di browser MetaMask. <a href={`https://metamask.app.link/dapp/${window.location.host}${window.location.pathname}`}>Buka di MetaMask ↗</a></div>}
      {walletError && <div className="notice error" role="alert">{walletError}<button className="text-button" onClick={() => syncWallet(accountRef.current)}>Perbarui wallet</button></div>}
      {account && wrongChain && <div className="chainwarn" role="alert">Wallet berada di network lain.<button disabled={walletBusy} onClick={onSwitchChain}>{walletBusy ? 'Konfirmasi di wallet…' : 'Pindah ke Robinhood Testnet'}</button></div>}
      <div hidden={!profileOpen}><WalletProfile active={profileOpen} account={account} ethBalance={ethBalance} tokens={tokens} tokensState={listState} balanceVersion={balanceVersion} onConnect={onConnect} walletBusy={walletBusy} onTrade={(token) => { if (token) openToken(token.token); else navigate('explore'); }} /></div>
      <main className="layout" hidden={route.page !== 'explore'}>
        <section className="list-pane" id="explore" aria-label="Daftar token">
          <div className="pane-head"><div><h2>Explore tokens <span className="count">{tokens.length}</span></h2><p className="section-sub">Dari bonding curve ke pool. Semua berawal di sini.</p></div><button className="ghost" disabled={refreshing} onClick={() => refreshList(true)}>{refreshing ? 'Memperbarui…' : '↻ Refresh'}</button></div>
          <div className="explore-filters"><label>Status<select value={phaseFilter} onChange={(e) => setPhaseFilter(e.target.value)}><option value="all">Semua status</option><option value="0">Bonding Curve</option><option value="1">Menunggu Pool</option><option value="2">Graduated</option><option value="3">Dibatalkan</option></select></label><label>Urutan<select value={sort} onChange={(e) => setSort(e.target.value)}><option value="progress">Progres graduation</option><option value="newest">Terbaru</option><option value="name">Nama A–Z</option></select></label></div>
          <input className="search" aria-label="Cari token" placeholder="Cari nama, simbol, atau alamat token…" value={search} onChange={(e) => setSearch(e.target.value)} />
          {listError && <div className="notice error" role="alert">{listError}<button className="text-button" onClick={() => refreshList()}>Coba lagi</button></div>}
          {listState === 'loading' && <div className="state" role="status"><div className="spin" />Mengambil token dari chain…<div className="state-sub">Riwayat launch diambil bertahap dari factory.</div></div>}
          {listState === 'error' && <div className="state"><div className="state-title">Gagal memuat daftar token</div><button className="connect" onClick={() => refreshList(true)}>Coba lagi</button></div>}
          {listState === 'ready' && !filtered.length && <div className="state"><div className="state-title">{tokens.length ? 'Token tidak ditemukan' : 'Belum ada token ETH'}</div><div className="state-sub">{tokens.length ? 'Coba nama atau simbol lain.' : 'Token baru akan muncul setelah diluncurkan.'}</div></div>}
          <div className="token-grid">{listState === 'ready' && filtered.map((t) => <TokenCard key={t.token} token={t} selected={t.token === selected} disabled={txBusy} onDetails={() => openToken(t.token)} onSelect={(tk) => { setSelected(tk.token); if (window.matchMedia('(max-width: 760px)').matches) document.getElementById('trade')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); }} />)}</div>
          {updatedAt && <p className="updated">Diperbarui {updatedAt.toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' })} · otomatis setiap 20 detik</p>}
        </section>
        <section className="buy-pane" id="trade" aria-label="Beli token">
          {selectedToken ? <BuyForm token={selectedToken} account={account} ethBalance={ethBalance} wrongChain={wrongChain} externalBusy={txBusy} onBought={onBought} onBusy={setTxBusy} balanceVersion={balanceVersion} onRefresh={() => refreshList()} /> : <div className="state"><div className="state-title">Pilih token untuk membeli</div><div className="state-sub">Estimasi dan detail biaya akan tampil di sini.</div></div>}
          <p className="panel-note">Transaksi dikirim melalui wallet pilihanmu di testnet. Harga spot berbeda dari harga pembelian karena fee dan price impact.</p>
        </section>
      </main>
      <div hidden={route.page !== 'launch'}><LaunchPage active={route.page === 'launch'} account={account} wrongChain={wrongChain} ethBalance={ethBalance} globalBusy={txBusy} onBusy={setTxBusy} onConfirmed={onBought} onConnect={onConnect} walletBusy={walletBusy} onOpenToken={openToken} /></div>
      <div hidden={route.page !== 'activity'}><ActivityPage active={route.page === 'activity'} tokens={tokens} tokensState={listState} onOpenToken={openToken} globalBusy={txBusy} /></div>
      <div hidden={route.page !== 'token'}><TokenDetail token={detailToken} active={route.page === 'token'} account={account} wrongChain={wrongChain} ethBalance={ethBalance} balanceVersion={balanceVersion} globalBusy={txBusy} onBusy={setTxBusy} onConfirmed={onBought} onBuy={showBuy} onOpenToken={openToken} onRefresh={() => refreshList(true)} listState={listState} /></div>
      <div hidden={route.page !== 'guide'}><GuidePage onExplore={() => navigate('explore')} onLaunch={() => navigate('launch')} /></div>
      <footer className="foot"><span className="footer-brand">launchpad. <span>Built for the early ones.</span></span><a href="https://faucet.testnet.chain.robinhood.com/" target="_blank" rel="noreferrer">Ambil ETH testnet ↗</a></footer>
    </div>
  );
}
