import React from 'react';
import ReactDOM from 'react-dom/client';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import { walletConfig } from './web3/wallet.js';
import { robinhoodTestnet } from './web3/chain.js';
import App from './App.jsx';
import './index.css';

const queryClient = new QueryClient();
const theme = darkTheme({ accentColor: '#c5f467', accentColorForeground: '#0b0d0b', borderRadius: 'small', overlayBlur: 'small' });
theme.fonts.body = 'Space Grotesk, sans-serif';
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <WagmiProvider config={walletConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={theme} initialChain={robinhoodTestnet} modalSize="compact">
          <App />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>,
);
