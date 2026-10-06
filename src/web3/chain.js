import { defineChain } from 'viem';

export const CHAIN_ID = 46630;
export const CHAIN_ID_HEX = '0xB626';
export const FACTORY = '0x533cE670f1372cb402D49866608b92e7bc2b4493';
export const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11';
export const DEPLOY_BLOCK = 129157568n;
export const LOG_CHUNK = 50000n; // batas RPC: eth_getLogs max 50.000 blok
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
export const EXPLORER = 'https://explorer.testnet.chain.robinhood.com';

export const robinhoodTestnet = defineChain({
  id: CHAIN_ID,
  name: 'Robinhood Chain Testnet',
  nativeCurrency: { decimals: 18, name: 'Ether', symbol: 'ETH' },
  rpcUrls: {
    default: { http: ['https://rpc.testnet.chain.robinhood.com/rpc', 'https://robinhood-sepolia-rpc.publicnode.com'] },
  },
  blockExplorers: {
    default: { name: 'Robinhood Explorer', url: EXPLORER },
  },
  contracts: {
    multicall3: { address: MULTICALL3, blockCreated: 129157568 },
  },
});

export const PHASE_LABEL = ['Bonding Curve', 'Menunggu Pool', 'Graduated', 'Dibatalkan'];
