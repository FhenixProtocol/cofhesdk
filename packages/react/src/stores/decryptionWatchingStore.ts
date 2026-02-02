import type { QueryKey } from '@tanstack/react-query';
import type { Address } from 'viem';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { TransactionActionType } from './transactionStore';

export type DecryptionWatcherStatus = 'scheduled' | 'executed';

export type DecryptionWatcher = {
  key: `${TransactionActionType}-tx-0x${string}`;
  createdAt: number;
  triggerTxHash: `0x${string}`;
  decryptionObservedAt?: {
    blockNumber: bigint;
    timestamp: number;
    blockHash?: `0x${string}`;
  };
  chainId: number;
  accountAddress: Address;
  queryKeys: QueryKey[];
};

type DecryptionWatchersState = {
  byKey: Record<string, DecryptionWatcher>;

  upsert: (input: Omit<DecryptionWatcher, 'status'> & { status?: DecryptionWatcherStatus }) => void;
  setDecryptionObservedAt: (params: { key: string; blockNumber: bigint; blockHash?: `0x${string}` }) => void;
  findObservedDecryption: (queryKey: QueryKey) => DecryptionWatcher | undefined;
  removeQueryKeyFromWatchers: (queryKey: QueryKey) => void;
};

// Custom storage to handle bigint serialization
const bigintStorage = createJSONStorage<DecryptionWatchersState>(() => localStorage, {
  reviver: (_key, value) => {
    if (typeof value === 'object' && value !== null && '__bigint__' in value) {
      return BigInt((value as { __bigint__: string }).__bigint__);
    }
    return value;
  },
  replacer: (_key, value) => {
    if (typeof value === 'bigint') {
      return { __bigint__: value.toString() };
    }
    return value;
  },
});

export const useDecryptionWatchersStore = create<DecryptionWatchersState>()(
  persist(
    (set, get) => ({
      byKey: {},

      upsert: (input) => {
        set((state) => {
          return {
            byKey: {
              ...state.byKey,
              [input.key]: input,
            },
          };
        });
      },
      findObservedDecryption: (queryKey) => {
        return Object.values(get().byKey).find((item) =>
          item.queryKeys.some((key) => JSON.stringify(key) === JSON.stringify(queryKey) && !!item.decryptionObservedAt)
        );
      },
      removeQueryKeyFromWatchers: (queryKey) => {
        set((state) => {
          const updatedByKey = { ...state.byKey };
          // remove the queryKey from all scheduled invalidations
          for (const [key, item] of Object.entries(updatedByKey)) {
            const matchingIndex = item.queryKeys.findIndex(
              (keyInItem) => JSON.stringify(keyInItem) === JSON.stringify(queryKey)
            );
            if (matchingIndex !== -1) {
              const newQueryKeys = [...item.queryKeys];
              newQueryKeys.splice(matchingIndex, 1);
              updatedByKey[key] = {
                ...item,
                queryKeys: newQueryKeys,
              };
            }
          }

          // if any invalidation has no more queryKeys, remove it entirely
          for (const [key, item] of Object.entries(updatedByKey)) {
            if (item.queryKeys.length === 0) {
              delete updatedByKey[key];
            }
          }
          return {
            byKey: updatedByKey,
          };
        });
      },

      setDecryptionObservedAt: ({
        key,
        blockNumber,
        blockHash,
      }: {
        key: string;
        blockNumber: bigint;
        blockHash?: `0x${string}`;
      }) => {
        set((state) => {
          const existing = state.byKey[key];
          if (!existing) return state;
          return {
            byKey: {
              ...state.byKey,
              [key]: {
                ...existing,
                decryptionObservedAt: {
                  blockNumber,
                  blockHash,
                  timestamp: Date.now(),
                },
              },
            },
          };
        });
      },
    }),
    {
      name: 'cofhe-scheduled-invalidations',
      storage: bigintStorage,
      version: 1,
    }
  )
);
