import { WagmiProvider, http, createConfig } from 'wagmi';
import { baseSepolia, sepolia } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const config = createConfig({
  chains: [baseSepolia, sepolia],
  transports: {
    [sepolia.id]: http(),
    [baseSepolia.id]: http(),
  },
  // to avoid eager connection attempts by wagmi: 1. disable multiInjectedProviderDiscovery 2. don't pass injected() into connectors
  multiInjectedProviderDiscovery: false,
  connectors: [],
  ssr: false,
  syncConnectedChain: true,
});

const qc = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
