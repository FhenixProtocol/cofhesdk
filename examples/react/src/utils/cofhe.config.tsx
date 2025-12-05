import { CofheProvider, createCofhesdkClient, createCofhesdkConfig } from '@cofhe/react';
import { sepolia, baseSepolia } from '@cofhe/sdk/chains';

const cofheConfig = createCofhesdkConfig({
  supportedChains: [sepolia, baseSepolia],
  // useWorkers: true, // Enable Web Workers
  react: {},
});

const cofheSdkClient = createCofhesdkClient(cofheConfig);
export const CofheProviderLocal = ({ children }: { children: React.ReactNode }) => {
  return (
    <CofheProvider cofhesdkClient={cofheSdkClient} config={cofheConfig}>
      {children}
    </CofheProvider>
  );
};
