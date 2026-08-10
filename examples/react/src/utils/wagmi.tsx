import { WagmiProvider, http, createConfig, injected } from 'wagmi';
import { baseSepolia, sepolia, arbitrumSepolia } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { pickMetaMaskProvider, pickOkxProvider } from './walletProviders';

export const metaMaskConnector = injected({
  shimDisconnect: true,
  target: {
    id: 'metamask',
    name: 'MetaMask',
    provider: pickMetaMaskProvider,
  },
});

export const okxConnector = injected({
  shimDisconnect: true,
  target: {
    id: 'okxwallet',
    name: 'OKX Wallet',
    provider: pickOkxProvider,
  },
});

const config = createConfig({
  chains: [sepolia, baseSepolia, arbitrumSepolia],
  transports: {
    [sepolia.id]: http(),
    [baseSepolia.id]: http(),
    [arbitrumSepolia.id]: http(),
  },
  connectors: [metaMaskConnector, okxConnector],
  ssr: false,
  syncConnectedChain: true,
});

const wagmiQueryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider
      config={config}
      reconnectOnMount={false}
    >
      <QueryClientProvider client={wagmiQueryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
