import { CofheProvider, createCofhesdkClient, createCofhesdkConfig } from '@cofhe/react';
import { useEffect } from 'react';
import { usePublicClient, useWalletClient } from 'wagmi';
import { sepolia, baseSepolia } from '@cofhe/sdk/chains';

const cofheConfig = createCofhesdkConfig({
  client: {
    supportedChains: [sepolia, baseSepolia],
    // useWorkers: true, // Enable Web Workers
  },
  widget: {},
});

// console.log('Cofhesdk Config:', cofheConfig);

const config = createCofhesdkConfig(cofheConfig);
// eslint-disable-next-line react-refresh/only-export-components
export const cofheSdkClient = createCofhesdkClient(config.client);

export const CofheProviderLocal = ({ children }: { children: React.ReactNode }) => {
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  useEffect(() => {
    async function handleConnect() {
      if (!publicClient || !walletClient) return;

      await cofheSdkClient.connect(publicClient, walletClient);
    }
    handleConnect();
  }, [walletClient, publicClient]);

  return <CofheProvider client={cofheSdkClient}>{children}</CofheProvider>;
};
