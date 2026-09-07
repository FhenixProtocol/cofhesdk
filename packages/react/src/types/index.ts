import type { CofheClient } from '@cofhe/sdk';
import type { CofheConfigWithReact } from '../config';
import type { QueryClient } from '@tanstack/react-query';
import type { PublicClient } from 'viem';
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
  /** App-supplied clients for chain-pinned reads; see CofheProviderProps.publicClients. */
  publicClients?: Readonly<Record<number, PublicClient>>;

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
   * Optional per-chain public clients for CHAIN-PINNED reads (the read hooks: chainId param).
   * A read pinned to a non-connected chain fetches through the matching client here; without an
   * entry it stays disabled. Supply clients with the same transport care as publicClient —
   * batching recommended, since the block-aware gate batches its probe with the read. The
   * connected chain needs no entry.
   */
  publicClients?: Readonly<Record<number, PublicClient>>;

  /**
   * Optional transaction renderers keyed by actionType. For custom action types (`custom-${string}`),
   * actionType serves as the renderer mapping key.
   *
   * This intentionally lives on the React provider rather than createCofheConfig({ react }). Renderer
   * values are React components/functions, while the config object is schema-validated and can be
   * created outside React UI setup or shared with non-rendering SDK setup.
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
