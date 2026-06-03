import type { CofheClient } from '@cofhe/sdk';
import type { CofheConfigWithReact } from '../config';
import type { QueryClient } from '@tanstack/react-query';
import type { PublicClientLike, WalletClientLike } from '../utils/viemClientBridge';
import type { FloatingButtonPosition } from '@/components/CofheFloatingButton/types';
import type { Transaction, TransactionActionType } from '@/stores/transactionStore';

export type TransactionRendererProps<TTransaction extends Transaction = Transaction> = {
  transaction: TTransaction;
};

export type TransactionRenderer<TTransaction extends Transaction = Transaction> = (
  props: TransactionRendererProps<TTransaction>
) => React.ReactNode;

export type TransactionRenderers = Partial<Record<TransactionActionType, TransactionRenderer>>;

export interface CofheContextValue {
  client: CofheClient<CofheConfigWithReact>;
  transactionRenderers?: TransactionRenderers;

  // dynamic values, which aren't worth re-creating the whole client on each change via config
  state: {
    position: FloatingButtonPosition;
    setPosition: (position: FloatingButtonPosition) => void;

    theme: 'dark' | 'light';
    setTheme: (theme: 'dark' | 'light') => void;
  };
}

export type CofheProviderProps = {
  children: React.ReactNode;
  queryClient?: QueryClient;

  // TODO: i still think the below must be mutually exclusive on a type level. If both are passed - that's an indication of potential error (two sources of truth for config)
  // can provide either pre-created client together with the config it was created with
  cofheClient?: CofheClient<CofheConfigWithReact>;
  // ... or just provide config to create the client internally
  config?: CofheConfigWithReact;

  // @TODO: define our own pair of classes, with only the methods we need
  walletClient?: WalletClientLike;
  publicClient?: PublicClientLike;

  /**
   * Optional transaction renderers keyed by actionType. For custom action types (`custom-${string}`),
   * actionType serves as the renderer mapping key.
   */
  transactionRenderers?: TransactionRenderers;
};

export interface CofheClientConfig {
  // Add configuration options as needed
  chainId?: number;
  rpcUrl?: string;
}

// Re-export component types
export * from './component-types.js';
