import { CofheProvider, createCofhesdkClient, createCofhesdkConfig } from '@cofhe/react';
import { useEffect } from 'react';
import { usePublicClient, useWalletClient } from 'wagmi';
import { sepolia, baseSepolia } from '@cofhe/sdk/chains';
import { createMockWalletAndPublicClient } from './misc';

const cofheConfig = createCofhesdkConfig({
  supportedChains: [sepolia, baseSepolia],
  // useWorkers: true, // Enable Web Workers

  react: {},
});

// console.log('Cofhesdk Config:', cofheConfig);

const config = createCofhesdkConfig(cofheConfig);
// eslint-disable-next-line react-refresh/only-export-components
export const cofheSdkClient = createCofhesdkClient(config);

export const CofheProviderLocal = ({ children }: { children: React.ReactNode }) => {
  const walletClientResult = useWalletClient();
  const { data: walletClient } = walletClientResult;
  const publicClient = usePublicClient();

  useEffect(() => {
    async function handleConnect() {
      if (cofheSdkClient.connecting || cofheSdkClient.connected) return;
      // NB: fallback to mock clients if no wallet is connected

      const pairToUse =
        walletClient && publicClient ? { walletClient, publicClient } : createMockWalletAndPublicClient();

      await cofheSdkClient.connect(pairToUse.publicClient, pairToUse.walletClient);
    }
    handleConnect();
  }, [walletClient, publicClient]);

  return (
    <CofheProvider client={cofheSdkClient} config={config}>
      {children}
    </CofheProvider>
  );
};
