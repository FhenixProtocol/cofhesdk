import { CofheProvider, createCofhesdkConfig } from '@cofhe/react';
import { useClientsForCofheConnection } from './useClientsForCofheConnection';
import { baseSepolia, sepolia } from '@cofhe/sdk/chains';

const cofhesdkConfig = createCofhesdkConfig({
  supportedChains: [sepolia, baseSepolia],
  // useWorkers: true, // Enable Web Workers
  react: {
    recordTransactionHistory: true, // Enable activity page in floating button
    // pinnedTokens: {
    //   11155111: '0xd38AB9f1563316DeD5d3B3d5e727d55f410d492E',
    // },
  },
});
export const CofheProviderLocal = ({ children }: { children: React.ReactNode }) => {
  const { walletClient, publicClient } = useClientsForCofheConnection();
  return (
    <CofheProvider
      config={cofhesdkConfig}
      autoConnect={{
        walletClient,
        publicClient,
      }}
    >
      {children}
    </CofheProvider>
  );
};
