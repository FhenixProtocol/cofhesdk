import type { CofhesdkClient } from '@cofhe/sdk';
import type { CofhesdkConfigWithWidget } from '../widget/index.js';
import type { QueryClient } from '@tanstack/react-query';

export interface CofheContextValue {
  client: CofhesdkClient | null;
  isInitialized: boolean;
  error: Error | null;
  config?: CofhesdkConfigWithWidget;
}

export interface CofheProviderProps {
  children: React.ReactNode;
  client?: CofhesdkClient;
  config?: CofhesdkConfigWithWidget;
  queryClient?: QueryClient;
}

export interface CofheClientConfig {
  // Add configuration options as needed
  chainId?: number;
  rpcUrl?: string;
}

// Re-export component types
export * from './component-types.js';
