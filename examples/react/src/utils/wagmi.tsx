import { WagmiProvider, http, createConfig, injected } from 'wagmi';
import { baseSepolia, sepolia, arbitrumSepolia } from 'wagmi/chains';
import { defineChain } from 'viem';

// Local CoFHE stack (docker compose) — for manual e2e testing incl. on-chain sharing
export const localcofheChain = defineChain({
  id: 420105,
  name: 'Local CoFHE',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [import.meta.env.VITE_LOCALCOFHE_RPC_URL ?? 'http://127.0.0.1:42069'] } },
});
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
  chains: [sepolia, baseSepolia, arbitrumSepolia, localcofheChain],
  transports: {
    [sepolia.id]: http(),
    [baseSepolia.id]: http(),
    [arbitrumSepolia.id]: http(),
    [localcofheChain.id]: http(),
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
