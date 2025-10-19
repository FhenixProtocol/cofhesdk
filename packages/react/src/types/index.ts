import type { CofhesdkClient } from '@cofhesdk/web';

export interface CofheContextValue {
  client: CofhesdkClient | null;
  isInitialized: boolean;
  error: Error | null;
}

export interface CofheProviderProps {
  children: React.ReactNode;
  client?: CofhesdkClient;
  config?: CofheClientConfig;
}

export interface CofheClientConfig {
  // Add configuration options as needed
  chainId?: number;
  rpcUrl?: string;
}

// Re-export component types
export * from './component-types.js';
