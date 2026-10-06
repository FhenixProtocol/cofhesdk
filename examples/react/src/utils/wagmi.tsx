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
      // Root cause not confirmed. Note that the generic `injectedProvider` IS part of config.connectors, and
      // EIP-6963 discovery is left at wagmi's default (enabled), so discovered wallets are appended to
      // config.connectors at runtime. The connect UI lists them via useConnectors().
      reconnectOnMount={false}
    >
      <QueryClientProvider client={wagmiQueryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
