import { CofheProvider, createCofheConfig, useInternalQueryClient } from '@cofhe/react';
import { CofheFloatingButtonWithProvider } from '@cofhe/react/ui';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { sepolia } from '@cofhe/sdk/chains';

function QueryDebug() {
  const cofheQueryClient = useInternalQueryClient();
  return <ReactQueryDevtools client={cofheQueryClient} position="left" buttonPosition="bottom-left" />;
}
const cofheConfig = createCofheConfig({
  supportedChains: [
    sepolia,
    //  baseSepolia
  ],
  react: {
    projectName: 'Demo App',
    logger: {
      log: console.log.bind(console, '[COFHE]'),
      warn: console.warn.bind(console, '[COFHE]'),
      error: console.error.bind(console, '[COFHE]'),
      debug: console.debug.bind(console, '[COFHE]'),
    },
    // pinnedTokens: {
    //   11155111: '0x87A3effB84CBE1E4caB6Ab430139eC41d156D55A', // sepolia weth
    //   84532: '0xbED96aa98a49FeA71fcC55d755b915cF022a9159', // base sepolia weth
    // },
    tokenLists: {
      // 11155111: ['https://storage.googleapis.com/cofhesdk/sepolia.json'],
      11155111: ['https://api.npoint.io/2d295a8f9f9d2c0c6678'], // contains only ETH
      // 11155111: [
      //   'https://api.npoint.io/439ce3fd4b44eaa6f917', // contains "failing usdc"
      // ],
      84532: ['https://storage.googleapis.com/cofhesdk/base-sepolia.json'],
      421613: ['https://tokens.cofhe.io/arbitrum-sepolia.json'],
    },
  },
});

export const CofheProviderLocal = ({ children }: { children: React.ReactNode }) => {
  const wagmiPublicClient = usePublicClient();
  const { data: wagmiWalletClient } = useWalletClient();

  const { chain } = useAccount();

  const isConnectedToWagmiSupportedChain = chain !== undefined;

  return (
    <CofheProvider
      walletClient={isConnectedToWagmiSupportedChain ? wagmiWalletClient : undefined}
      publicClient={isConnectedToWagmiSupportedChain ? wagmiPublicClient : undefined}
      config={cofheConfig}
    >
      {children}
      <QueryDebug />
      <CofheFloatingButtonWithProvider />
    </CofheProvider>
  );
};
