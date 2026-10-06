import { publicClient } from './client.js';
import { curveAbi, tokenAbi } from './abis.js';
import { DEPLOY_BLOCK, LOG_CHUNK } from './chain.js';

// In-memory history cache is account/curve scoped; balances always come from chain.
const historyCache = new Map();
export async function fetchWalletPortfolio(tokens, account) {
  const latest = await publicClient.getBlockNumber({ cacheTime: 0 });
  if (!tokens.length) return { holdings: [], purchases: [], activities: [], latestBlock: latest, partial: false };
  const addresses = [...new Set(tokens.map((t) => t.curve.toLowerCase()))].sort();
  const key = `${account.toLowerCase()}:${addresses.join(',')}`;
  const cached = historyCache.get(key);
  const fromBlock = cached && cached.latestBlock <= latest ? cached.latestBlock + 1n : DEPLOY_BLOCK;
  const events = curveAbi.filter((item) => item.type === 'event' && ['CurveBuy', 'CurveSell'].includes(item.name));
  const requests = [];
  for (let start = fromBlock; start <= latest; start += LOG_CHUNK) {
    const end = start + LOG_CHUNK - 1n > latest ? latest : start + LOG_CHUNK - 1n;
    for (let i = 0; i < addresses.length; i += 40) for (const event of events) requests.push({
      address: addresses.slice(i, i + 40), event, args: { recipient: account },
      strict: true, fromBlock: start, toBlock: end,
    });
  }
  const balancesPromise = publicClient.multicall({
    contracts: tokens.map((token) => ({ address: token.token, abi: tokenAbi, functionName: 'balanceOf', args: [account] })),
    allowFailure: true, blockNumber: latest,
  });
  // Promise.all below observes failures from both balances and the full log scan.
  const historyPromise = (async () => {
    const events = [];
    for (let i = 0; i < requests.length; i += 3) {
      const pages = await Promise.all(requests.slice(i, i + 3).map((request) => publicClient.getLogs(request)));
      events.push(...pages.flat());
    }
    return events;
  })();
  const [balances, logs] = await Promise.all([balancesPromise, historyPromise]);
  const history = new Map(cached && cached.latestBlock <= latest ? cached.history : []);
  for (const log of logs) history.set(`${log.transactionHash}:${log.logIndex}`, {
    ...log.args, kind: log.eventName === 'CurveBuy' ? 'buy' : 'sell', curve: log.address, hash: log.transactionHash,
    logIndex: log.logIndex, blockNumber: log.blockNumber,
  });
  // Only commit the cursor once both reads succeeded.
  historyCache.set(key, { latestBlock: latest, history });
  if (historyCache.size > 10) historyCache.delete(historyCache.keys().next().value);
  const byCurve = new Map(tokens.map((token) => [token.curve.toLowerCase(), token]));
  const activities = [...history.values()].map((purchase) => ({ ...purchase, token: byCurve.get(purchase.curve.toLowerCase()) }))
    .sort((a, b) => a.blockNumber === b.blockNumber ? b.logIndex - a.logIndex : a.blockNumber > b.blockNumber ? -1 : 1);
  return {
    latestBlock: latest, activities, purchases: activities.filter((entry) => entry.kind === 'buy'),
    holdings: tokens.map((token, i) => ({ token, balance: balances[i]?.status === 'success' ? balances[i].result : null })),
    partial: balances.some((result) => result.status !== 'success'),
  };
}
