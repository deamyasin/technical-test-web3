import { getAccount, getWalletClient as getConnectedWalletClient, switchChain } from '@wagmi/core';
import { walletConfig } from './wallet.js';
import {
  createPublicClient, http, fallback,
  decodeEventLog, decodeErrorResult, parseEther, formatEther, formatUnits,
} from 'viem';
import { robinhoodTestnet, FACTORY, DEPLOY_BLOCK, LOG_CHUNK, CHAIN_ID, CHAIN_ID_HEX, EXPLORER, ZERO_ADDRESS } from './chain.js';
import { factoryAbi, curveAbi, tokenAbi } from './abis.js';

export const publicClient = createPublicClient({ chain: robinhoodTestnet, transport: fallback(robinhoodTestnet.rpcUrls.default.http.map((url) => http(url, { timeout: 12000, retryCount: 1 })), { rank: false }) });
export async function getWalletClient() {
  if (!getAccount(walletConfig).isConnected) throw new Error('NO_WALLET');
  return getConnectedWalletClient(walletConfig);
}
export async function ensureCorrectChain() {
  await switchChain(walletConfig, { chainId: CHAIN_ID });
  return true;
}
export const getEthBalance = (address) => publicClient.getBalance({ address });

export async function fetchTokenLaunches(fromBlock = DEPLOY_BLOCK) {
  const latest = await publicClient.getBlockNumber({ cacheTime: 0 });
  const event = factoryAbi.find((item) => item.type === 'event' && item.name === 'TokenLaunched');
  const ranges = [];
  for (let start = fromBlock; start <= latest; start += LOG_CHUNK) {
    ranges.push([start, start + LOG_CHUNK - 1n > latest ? latest : start + LOG_CHUNK - 1n]);
  }
  const logs = [];
  // Bounded concurrency avoids flooding the public RPC when history grows.
  for (let i = 0; i < ranges.length; i += 3) {
    const pages = await Promise.all(ranges.slice(i, i + 3).map(([fromBlock, toBlock]) =>
      publicClient.getLogs({ address: FACTORY, event, strict: true, fromBlock, toBlock })));
    logs.push(...pages.flat());
  }
  const seen = new Map();
  for (const log of logs) {
    const { token, curve, deployer, pairToken } = log.args;
    if (pairToken.toLowerCase() !== ZERO_ADDRESS) continue;
    seen.set(token.toLowerCase(), { token, curve, deployer, pairToken, blockNumber: log.blockNumber });
  }
  return { launches: [...seen.values()], latestBlock: latest };
}

const DATA_CALLS = 11;
export async function fetchTokensData(launches, recipient = ZERO_ADDRESS) {
  if (!launches.length) return [];
  const blockNumber = await publicClient.getBlockNumber({ cacheTime: 0 });
  const contracts = launches.flatMap((l) => [
    ...['name', 'symbol', 'logo', 'decimals'].map((functionName) => ({ address: l.token, abi: tokenAbi, functionName })),
    ...['getReserves', 'realQuoteReserve', 'graduationThreshold', 'feeBps', 'creatorTaxBps'].map((functionName) => ({ address: l.curve, abi: curveAbi, functionName })),
    { address: l.curve, abi: curveAbi, functionName: 'currentSnipeTaxBps', args: [recipient] },
    { address: FACTORY, abi: factoryAbi, functionName: 'getLaunchedToken', args: [l.token] },
  ]);
  const results = await publicClient.multicall({ contracts, allowFailure: true, blockNumber });
  return launches.map((l, i) => {
    const r = results.slice(i * DATA_CALLS, (i + 1) * DATA_CALLS);
    const read = (index, fallback) => r[index]?.status === 'success' ? r[index].result : fallback;
    const [quoteReserve, tokenReserve] = read(4, [0n, 0n]);
    const realQuoteReserve = read(5, 0n);
    const graduationThreshold = read(6, 0n);
    const phase = Number(read(10, {})?.phase ?? -1);
    const feeBps = read(7, 0n);
    const creatorTaxBps = read(8, 0n);
    const decimals = Number(read(3, 18));
    const rawProgress = graduationThreshold > 0n ? realQuoteReserve * 10000n / graduationThreshold : 0n;
    const dataValid = [3, 4, 5, 6, 7, 8, 9, 10].every((idx) => r[idx]?.status === 'success')
      && phase >= 0 && phase <= 3 && feeBps + creatorTaxBps < 10000n;
    return { ...l, name: read(0, 'Token'), symbol: read(1, '???'), logo: read(2, ''), decimals,
      quoteReserve, tokenReserve, realQuoteReserve, graduationThreshold,
      feeBps, creatorTaxBps, snipeTaxBps: read(9, 0n), phase, dataValid,
      recipient, blockNumber,
      priceWad: tokenReserve > 0n ? quoteReserve * 10n ** BigInt(decimals + 18) / tokenReserve : 0n,
      priceDecimals: 36,
      progressBps: rawProgress > 10000n ? 10000n : rawProgress,
    };
  });
}
export const getTokenBalance = (token, account) => publicClient.readContract({ address: token, abi: tokenAbi, functionName: 'balanceOf', args: [account] });

export function estimateBuy(quoteIn, feeBps, creatorTaxBps, quoteReserve, tokenReserve, snipeTaxBps = 0n) {
  const feeRate = BigInt(feeBps), creatorRate = BigInt(creatorTaxBps);
  const maximumSnipe = 9900n - feeRate - creatorRate;
  const snipeRate = BigInt(snipeTaxBps) > maximumSnipe ? maximumSnipe : BigInt(snipeTaxBps);
  const fee = quoteIn * feeRate / 10000n;
  const creatorTax = quoteIn * creatorRate / 10000n;
  const snipeTax = quoteIn * (snipeRate > 0n ? snipeRate : 0n) / 10000n;
  const net = quoteIn - fee - creatorTax - snipeTax;
  const tokensOut = net > 0n && quoteReserve > 0n && tokenReserve > 0n ? net * tokenReserve / (quoteReserve + net) : 0n;
  return { fee, creatorTax, snipeTax, tokensOut };
}
export const applySlippage = (tokensOut, slippageBps) => tokensOut * BigInt(10000 - slippageBps) / 10000n;
export function parseEthInput(str) {
  const value = (str || '').trim().replace(',', '.');
  if (!/^(?:\d+(?:\.\d{0,18})?|\.\d{1,18})$/.test(value)) return null;
  try { const parsed = parseEther(value); return parsed > 0n ? parsed : null; } catch { return null; }
}
const SUBS = '₀₁₂₃₄₅₆₇₈₉';
export function formatPrice(priceWad, decimals = 18) {
  if (priceWad <= 0n) return '—';
  const value = formatUnits(priceWad, decimals);
  const [whole, fraction = ''] = value.split('.');
  if (whole !== '0') return `${BigInt(whole).toLocaleString('en-US')}${fraction ? `.${fraction.slice(0, 4)}` : ''}`;
  const zeros = fraction.search(/[1-9]/);
  const significant = fraction.slice(zeros, zeros + 4).replace(/0+$/, '');
  return zeros < 2 ? `0.${'0'.repeat(zeros)}${significant}` : `0.0${String(zeros).split('').map((n) => SUBS[Number(n)]).join('')}${significant}`;
}
export const formatProgress = (bps) => `${(Number(bps > 10000n ? 10000n : bps) / 100).toFixed(1)}%`;
export function formatEth(wei) {
  const value = formatEther(wei);
  const [whole, fraction = ''] = value.split('.');
  const digits = fraction.slice(0, 6).replace(/0+$/, '');
  if (wei > 0n && wei < 1000000000000n) return '<0.000001';
  return digits ? `${whole}.${digits}` : whole;
}
export function formatTokens(wei, decimals = 18) {
  const [whole, fraction = ''] = formatUnits(wei, decimals).split('.');
  const digits = fraction.slice(0, 4).replace(/0+$/, '');
  if (wei > 0n && whole === '0' && !digits) return '<0.0001';
  return `${BigInt(whole).toLocaleString('en-US')}${digits ? `.${digits}` : ''}`;
}
export const shortAddress = (a) => a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '';

export async function prepareBuy({ curve, quoteIn, minTokensOut, account }) {
  const { request } = await publicClient.simulateContract({ address: curve, abi: curveAbi, functionName: 'buy', args: [quoteIn, minTokensOut, account], value: quoteIn, account });
  const [gas, gasPrice, balance] = await Promise.all([
    publicClient.estimateContractGas(request), publicClient.getGasPrice(), getEthBalance(account),
  ]);
  // Leave headroom for gas price changes between simulation and inclusion.
  const gasCost = gas * gasPrice * 120n / 100n;
  if (quoteIn + gasCost > balance) throw new Error('INSUFFICIENT_GAS_BALANCE');
  return { request, gasCost };
}
export async function buyToken(request) {
  const client = await getWalletClient();
  if (await client.getChainId() !== CHAIN_ID) throw new Error('WRONG_CHAIN');
  const accounts = await client.getAddresses();
  const expected = typeof request.account === 'string' ? request.account : request.account?.address;
  if (accounts[0]?.toLowerCase() !== expected?.toLowerCase()) throw new Error('ACCOUNT_CHANGED');
  return client.writeContract({ ...request, chain: robinhoodTestnet });
}
export async function waitBuyReceipt(hash, curve, recipient, onReplaced) {
  const receipt = await publicClient.waitForTransactionReceipt({ hash, onReplaced });
  let tokensOut = null;
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== curve.toLowerCase()) continue;
    try {
      const event = decodeEventLog({ abi: curveAbi, data: log.data, topics: log.topics });
      if (event.eventName === 'CurveBuy' && event.args.recipient.toLowerCase() === recipient.toLowerCase()) {
        tokensOut = (tokensOut ?? 0n) + event.args.tokensOut;
      }
    } catch { /* Other curve events are not purchase output. */ }
  }
  return { receipt, tokensOut };
}
export function translateError(error) {
  const chain = []; const seen = new Set();
  for (let item = error; item && !seen.has(item); item = item.cause) { seen.add(item); chain.push(item); }
  const message = chain.map((item) => `${item.message || ''} ${item.shortMessage || ''}`).join(' ').toLowerCase();
  if (chain.some((item) => item.code === 4001) || /user rejected|user denied/.test(message)) return 'Permintaan dibatalkan di wallet. Kamu bisa mencoba lagi.';
  const named = {
    SlippageExceeded: 'Harga bergerak melebihi toleransi slippage. Perbarui estimasi atau kurangi jumlah beli.',
    CurveGraduated: 'Token sudah tidak dijual di bonding curve. Pilih token lain.',
    ZeroAmount: 'Jumlah beli terlalu kecil. Masukkan jumlah ETH yang lebih besar.',
    NativeValueMismatch: 'Jumlah ETH transaksi tidak sesuai. Perbarui form dan coba lagi.',
    NotWhitelisted: 'Wallet belum diizinkan launch. Minta pengawas memberi akses untuk alamat ini.',
    LaunchEconomicsMismatch: 'Konfigurasi launch berubah. Perbarui data lalu coba launch lagi.',
    LaunchFeeNotPaid: 'Launch fee berubah atau tidak sesuai. Perbarui data dan ulangi.',
    InvalidTokenParams: 'Parameter token ditolak. Periksa nama, ticker, dan metadata.',
    WrongGraduationPhase: 'Status token berubah; pool tidak bisa dibuat pada phase sekarang.',
    NothingToGraduate: 'Tidak ada token yang siap graduation.',
    NotReadyToGraduate: 'Curve belum siap graduation. Tunggu target tercapai.',
    ERC20InsufficientAllowance: 'Allowance belum cukup. Approve jumlah token sebelum menjual.',
    ERC20InsufficientBalance: 'Saldo token tidak cukup untuk jumlah jual.',
  };
  for (const item of chain) {
    let name = item.data?.errorName || item.errorName;
    const data = typeof item.data === 'string' ? item.data : item.data?.data;
    if (!name && typeof data === 'string' && data.startsWith('0x')) {
      try { name = decodeErrorResult({ abi: [...curveAbi, ...factoryAbi, ...tokenAbi], data }).errorName; } catch { /* Unknown revert. */ }
    }
    if (named[name]) return named[name];
  }
  if (/insufficient funds|exceeds the balance|insufficient_gas_balance/.test(message)) return 'Saldo ETH tidak cukup untuk pembelian dan biaya gas. Kurangi jumlah beli.';
  if (message.includes('launch_not_allowed')) return 'Wallet belum diizinkan launch. Minta pengawas mengaktifkan canLaunch untuk alamat ini.';
  if (message.includes('no_wallet')) return 'Wallet belum terhubung. Pilih Connect Wallet untuk melanjutkan.';
  if (/wrong_chain|chain mismatch/.test(message)) return 'Pindah ke Robinhood Chain Testnet sebelum membeli.';
  if (message.includes('account_changed')) return 'Akun wallet berubah. Periksa akun dan ulangi pembelian.';
  if (/timeout|timed out/.test(message)) return 'RPC belum merespons. Coba lagi; jika transaksi sudah terkirim, periksa link explorer.';
  return 'Permintaan gagal diproses. Periksa koneksi dan status wallet, lalu coba lagi.';
}
export { EXPLORER, CHAIN_ID, CHAIN_ID_HEX };
export const txUrl = (hash) => `${EXPLORER}/tx/${hash}`;
