import { CofheProvider, createCofheConfig, useInternalQueryClient } from '@cofhe/react';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { usePublicClient, useWalletClient } from 'wagmi';
import { baseSepolia, sepolia } from '@cofhe/sdk/chains';

function QueryDebug() {
  const cofheQueryClient = useInternalQueryClient();
  return <ReactQueryDevtools client={cofheQueryClient} position="left" buttonPosition="bottom-left" />;
}
const cofheConfig = createCofheConfig({
  supportedChains: [sepolia, baseSepolia],
  react: {
    pinnedTokens: {
      11155111: '0x87A3effB84CBE1E4caB6Ab430139eC41d156D55A', // sepolia weth
      84532: '0xbED96aa98a49FeA71fcC55d755b915cF022a9159', // base sepolia weth
    },
  },
});

export const CofheProviderLocal = ({ children }: { children: React.ReactNode }) => {
  const wagmiPublicClient = usePublicClient();
  const { data: wagmiWalletClient } = useWalletClient();
  return (
    <CofheProvider walletClient={wagmiWalletClient} publicClient={wagmiPublicClient} config={cofheConfig}>
      {children}
      <QueryDebug />
    </CofheProvider>
  );
};
