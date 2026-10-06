import { publicClient } from './client.js';
import { curveAbi, tokenAbi } from './abis.js';
import { DEPLOY_BLOCK, LOG_CHUNK } from './chain.js';
import { parseUnits } from 'viem';

export function parseTokenInput(text, decimals) {
  const normalized = text.trim().replace(',', '.');
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized) || (normalized.split('.')[1]?.length || 0) > decimals) return null;
  try { const value = parseUnits(normalized, decimals); return value > 0n ? value : null; } catch { return null; }
}
export function estimateSell(tokensIn, token) {
  if (tokensIn <= 0n || token.tokenReserve <= 0n || token.quoteReserve <= 0n) return null;
  const gross = tokensIn * token.quoteReserve / (token.tokenReserve + tokensIn);
  const fee = gross * token.feeBps / 10000n;
  const tax = gross * token.creatorTaxBps / 10000n;
  return { gross, fee, tax, quoteOut: gross - fee - tax };
}
const activityCache = new Map();
export async function fetchMarketActivity(tokens) {
  if (!tokens.length) return [];
  const addresses = [...new Set(tokens.map((token) => token.curve.toLowerCase()))].sort();
  const key = addresses.join(',');
  const cached = activityCache.get(key);
  const latest = await publicClient.getBlockNumber({ cacheTime: 0 });
  const from = cached && cached.latest <= latest ? cached.latest + 1n : DEPLOY_BLOCK;
  const events = curveAbi.filter((item) => item.type === 'event' && ['CurveBuy', 'CurveSell'].includes(item.name));
  const requests = [];
  for (let start = from; start <= latest; start += LOG_CHUNK) {
    const toBlock = start + LOG_CHUNK - 1n > latest ? latest : start + LOG_CHUNK - 1n;
    for (let i = 0; i < addresses.length; i += 40) requests.push({ address: addresses.slice(i, i + 40), events, fromBlock: start, toBlock, strict: true });
  }
  const history = new Map(cached && cached.latest <= latest ? cached.history : []);
  for (let i = 0; i < requests.length; i += 3) {
    const pages = await Promise.all(requests.slice(i, i + 3).map((request) => publicClient.getLogs(request)));
    for (const log of pages.flat()) history.set(`${log.transactionHash}:${log.logIndex}`, {
      kind: log.eventName === 'CurveBuy' ? 'buy' : 'sell', ...log.args,
      curve: log.address, hash: log.transactionHash, blockNumber: log.blockNumber, logIndex: log.logIndex,
    });
  }
  activityCache.set(key, { latest, history });
  if (activityCache.size > 10) activityCache.delete(activityCache.keys().next().value);
  const lookup = new Map(tokens.map((token) => [token.curve.toLowerCase(), token]));
  return [...history.values()].map((entry) => ({ ...entry, token: lookup.get(entry.curve.toLowerCase()) }))
    .sort((a, b) => a.blockNumber === b.blockNumber ? b.logIndex - a.logIndex : a.blockNumber > b.blockNumber ? -1 : 1);
}
export async function fetchTokenDescription(token) {
  const result = await publicClient.multicall({ allowFailure: true, contracts: [
    { address: token, abi: tokenAbi, functionName: 'description' },
    { address: token, abi: tokenAbi, functionName: 'socials' },
  ] });
  return { description: result[0].status === 'success' ? result[0].result : null, socials: result[1].status === 'success' ? result[1].result : null };
}
export function safeExternalUrl(value) {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : null; } catch { return null; }
}
