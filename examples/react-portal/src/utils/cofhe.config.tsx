import { CofheProvider, createCofhesdkClient, createCofhesdkConfig } from '@cofhe/react';

const cofheConfig = createCofhesdkConfig({
  client: { supportedChains: [] },
  widget: {},
});

console.log('Cofhesdk Config:', cofheConfig);

const config = createCofhesdkConfig(cofheConfig);
const cofheSdkClient = createCofhesdkClient(config.client);

export const CofheProviderLocal = ({ children }: { children: React.ReactNode }) => {
  return <CofheProvider client={cofheSdkClient}>{children}</CofheProvider>;
};
