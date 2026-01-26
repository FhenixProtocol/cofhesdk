import { WagmiProvider, http, createConfig, injected } from 'wagmi';
import { baseSepolia, sepolia } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export const injectedProvider = injected({ shimDisconnect: true });
const config = createConfig({
  chains: [baseSepolia, sepolia],
  transports: {
    [sepolia.id]: http(),
    [baseSepolia.id]: http(),
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
