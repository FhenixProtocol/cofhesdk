import type { CofhesdkClient } from '@cofhe/sdk';
import type { CofhesdkConfigWithReact } from '../config';
import type { QueryClient } from '@tanstack/react-query';
import type { PublicClient, WalletClient } from 'viem';

export interface CofheContextValue {
  client: CofhesdkClient;
  config: CofhesdkConfigWithReact;
}

export type CofheProviderProps = {
  children: React.ReactNode;
  queryClient?: QueryClient;
  // can provide either pre-created client together with the config it was created with
  cofhesdkClient?: CofhesdkClient;
  // ... or just provide config to create the client internally
  config?: CofhesdkConfigWithReact;

  autoConnect?: {
    // @TODO: define our own pair of classes, with only the methods we need
    walletClient: WalletClient;
    publicClient: PublicClient;
  };
};

export interface CofheClientConfig {
  // Add configuration options as needed
  chainId?: number;
  rpcUrl?: string;
}

// Re-export component types
export * from './component-types.js';
