import type { QueryKey } from '@tanstack/react-query';
import type { Address } from 'viem';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { TransactionActionType } from './transactionStore';

export type ScheduledInvalidationStatus = 'scheduled' | 'executed';

export type ScheduledInvalidation = {
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
  status: ScheduledInvalidationStatus;
  executedAt?: number;
};

type ScheduledInvalidationsState = {
  byKey: Record<string, ScheduledInvalidation>;

  upsert: (input: Omit<ScheduledInvalidation, 'status'> & { status?: ScheduledInvalidationStatus }) => void;
  markExecuted: (key: string) => void;
  setDecryptionObservedAt: (params: { key: string; blockNumber: bigint; blockHash?: `0x${string}` }) => void;
  remove: (key: string) => void;
  findObservedDecryption: (queryKey: QueryKey) => ScheduledInvalidation | undefined;
  removeQueryKeyFromInvalidations: (queryKey: QueryKey) => void;
  clear: () => void;
};

// Safe localStorage access (avoid SSR crashes and private-mode issues)
const safeLocalStorage = {
  getItem: (name: string): string | null => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return localStorage.getItem(name);
      }
    } catch {
      // localStorage not available
    }
    return null;
  },
  setItem: (name: string, value: string): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(name, value);
      }
    } catch {
      // localStorage not available
    }
  },
  removeItem: (name: string): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem(name);
      }
    } catch {
      // localStorage not available
    }
  },
};

// Custom storage to handle bigint serialization
const bigintStorage = createJSONStorage<ScheduledInvalidationsState>(() => safeLocalStorage, {
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

export const useScheduledInvalidationsStore = create<ScheduledInvalidationsState>()(
  persist(
    (set, get) => ({
      byKey: {},

      upsert: (input) => {
        set((state) => {
          const existing = state.byKey[input.key];
          const next: ScheduledInvalidation = {
            ...(existing ?? {
              status: 'scheduled' as const,
            }),
            ...input,
            status: input.status ?? existing?.status ?? 'scheduled',
          };

          return {
            byKey: {
              ...state.byKey,
              [input.key]: next,
            },
          };
        });
      },
      findObservedDecryption: (queryKey) => {
        return Object.values(get().byKey).find((item) =>
          item.queryKeys.some((key) => JSON.stringify(key) === JSON.stringify(queryKey) && !!item.decryptionObservedAt)
        );
      },
      removeQueryKeyFromInvalidations: (queryKey) => {
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

      markExecuted: (key) => {
        set((state) => {
          const existing = state.byKey[key];
          if (!existing) return state;
          return {
            byKey: {
              ...state.byKey,
              [key]: {
                ...existing,
                status: 'executed',
                executedAt: Date.now(),
              },
            },
          };
        });
      },

      remove: (key) => {
        set((state) => {
          if (!state.byKey[key]) return state;
          const { [key]: _removed, ...rest } = state.byKey;
          return { byKey: rest };
        });
      },

      clear: () => set({ byKey: {} }),
    }),
    {
      name: 'cofhe-scheduled-invalidations',
      storage: bigintStorage,
      version: 1,
    }
  )
);
