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

export const injectedProvider = injected({ shimDisconnect: true });
const config = createConfig({
  chains: [sepolia, baseSepolia, arbitrumSepolia, localcofheChain],
  transports: {
    [sepolia.id]: http(),
    [baseSepolia.id]: http(),
    [arbitrumSepolia.id]: http(),
    [localcofheChain.id]: http(),
  },
  connectors: [injectedProvider],
  ssr: false,
  syncConnectedChain: true,
});

const wagmiQueryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider
      config={config}
      // TMP/TODO: had to disable reconnectOnMount to fix the problem with failed reconnecting even on button click.
      // possible cause: the way the example app works (i.e. prevent eager connect) -- we don't pass injected() connector into config.connectors, instead we pass it at the wagm connection time (on button click)
      // probably that's why it fails to reconnect
      reconnectOnMount={false}
    >
      <QueryClientProvider client={wagmiQueryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
