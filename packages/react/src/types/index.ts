import type { CofhesdkClient } from '@cofhe/sdk';
import type { CofhesdkConfigWithReact } from '../config';
import type { QueryClient } from '@tanstack/react-query';
import type { PublicClient, WalletClient } from 'viem';
import type { FloatingButtonPosition } from '@/components/FnxFloatingButton/types';

export interface CofheContextValue {
  client: CofhesdkClient<CofhesdkConfigWithReact>;

  // dynamic values, which aren't worth re-creating the whole client on each change via config
  state: {
    position: FloatingButtonPosition;
    setPosition: (position: FloatingButtonPosition) => void;

    darkMode: boolean;
    setDarkMode: (isDarkMode: boolean) => void;
  };
}

export type CofheProviderProps = {
  children: React.ReactNode;
  queryClient?: QueryClient;

  // TODO: i still think the below must be mutually exclusive on a type level. If both are passed - that's an indication of potential error (two sources of truth for config)
  // can provide either pre-created client together with the config it was created with
  cofhesdkClient?: CofhesdkClient<CofhesdkConfigWithReact>;
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
