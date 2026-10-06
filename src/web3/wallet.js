import { createConfig, fallback, http } from 'wagmi';
import { connectorsForWallets } from '@rainbow-me/rainbowkit';
import { injectedWallet, metaMaskWallet, rainbowWallet, trustWallet, walletConnectWallet } from '@rainbow-me/rainbowkit/wallets';
import { robinhoodTestnet } from './chain.js';

const projectId = (import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '').trim();
export const walletConnectEnabled = /^[a-f0-9]{32}$/i.test(projectId);
// Keep injected wallets available without sending an invalid project ID to the relay.
const wallets = walletConnectEnabled
  ? [metaMaskWallet, rainbowWallet, trustWallet, walletConnectWallet, injectedWallet]
  : [injectedWallet];
export const walletConfig = createConfig({
  chains: [robinhoodTestnet],
  multiInjectedProviderDiscovery: true,
  connectors: connectorsForWallets([{ groupName: 'Connect your wallet', wallets }], {
    appName: 'Launchpad', projectId,
    appUrl: typeof window === 'undefined' ? undefined : window.location.origin,
  }),
  transports: {
    [robinhoodTestnet.id]: fallback(robinhoodTestnet.rpcUrls.default.http.map((url) => http(url))),
  },
});
