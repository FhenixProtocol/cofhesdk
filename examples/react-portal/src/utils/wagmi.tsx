import { WagmiProvider, http, createConfig } from 'wagmi';
import { mainnet, polygon, arbitrum, base } from 'wagmi/chains';
import { injected } from 'wagmi/connectors';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const config = createConfig({
  chains: [mainnet, polygon, arbitrum, base],
  transports: {
    [mainnet.id]: http(),
    [polygon.id]: http(),
    [arbitrum.id]: http(),
    [base.id]: http(),
  },

  connectors: [injected({ shimDisconnect: true })],
  ssr: false,
  syncConnectedChain: true,
});

const qc = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      {/* @ts-expect-error-next-line - some error with types */}
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
