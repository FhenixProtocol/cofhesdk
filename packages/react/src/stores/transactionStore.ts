import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

type ChainRecord<T> = Record<number, T>;
type HashRecord<T> = Record<string, T>;

export enum TransactionStatus {
  Pending = 'pending',
  Failed = 'failed',
  Confirmed = 'confirmed',
}
export type TransactionStatusString = 'Pending' | 'Failed' | 'Confirmed';

export enum TransactionActionType {
  ShieldSend = 'shieldSend',
  Shield = 'shield',
  Unshield = 'unshielf',
  Claim = 'claim',
}
export type TransactionActionString = 'Shielded Transfer' | 'Shield' | 'Unshield' | 'Claim';

export interface Transaction {
  hash: string;
  status: TransactionStatus;
  tokenSymbol: string;
  tokenAmount: bigint;
  tokenDecimals: number;
  tokenAddress: `0x${string}`;
  chainId: number;
  actionType: TransactionActionType;
  timestamp: number;
  account: string;
}

export interface TransactionStore {
  transactions: ChainRecord<HashRecord<Transaction>>;
  addTransaction: (transaction: Omit<Transaction, 'status' | 'timestamp'>) => void;
  getTransaction: (chainId: number, hash: string) => Transaction | undefined;
  getAllTransactions: (chainId: number, account?: string) => Transaction[];
  getAllTransactionsByToken: (chainId: number, tokenAddress: string, account?: string) => Transaction[];
  updateTransactionStatus: (chainId: number, hash: string, status: TransactionStatus) => void;
  clearTransactions: (chainId?: number) => void;
}

const actionToStringMap: Record<TransactionActionType, TransactionActionString> = {
  [TransactionActionType.ShieldSend]: 'Shielded Transfer',
  [TransactionActionType.Shield]: 'Shield',
  [TransactionActionType.Unshield]: 'Unshield',
  [TransactionActionType.Claim]: 'Claim',
};

export const actionToString = (a: TransactionActionType): TransactionActionString => actionToStringMap[a];

const statusToStringMap: Record<TransactionStatus, TransactionStatusString> = {
  [TransactionStatus.Pending]: 'Pending',
  [TransactionStatus.Failed]: 'Failed',
  [TransactionStatus.Confirmed]: 'Confirmed',
};

export const statusToString = (a: TransactionStatus): TransactionStatusString => statusToStringMap[a];

// Safe localStorage access
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
const bigintStorage = createJSONStorage<TransactionStore>(() => safeLocalStorage, {
  reviver: (_key, value) => {
    // Convert serialized bigints back
    if (typeof value === 'object' && value !== null && '__bigint__' in value) {
      return BigInt((value as { __bigint__: string }).__bigint__);
    }
    return value;
  },
  replacer: (_key, value) => {
    // Serialize bigints
    if (typeof value === 'bigint') {
      return { __bigint__: value.toString() };
    }
    return value;
  },
});

export const useTransactionStore = create<TransactionStore>()(
  persist(
    (set, get) => ({
      transactions: {},

      addTransaction: (transaction: Omit<Transaction, 'status' | 'timestamp'>) => {
        set((state) => {
          const chainTxs = state.transactions[transaction.chainId] || {};
          return {
            transactions: {
              ...state.transactions,
              [transaction.chainId]: {
                ...chainTxs,
                [transaction.hash]: {
                  ...transaction,
                  status: TransactionStatus.Pending,
                  timestamp: Date.now(),
                },
              },
            },
          };
        });
      },

      updateTransactionStatus: (chainId: number, hash: string, status: TransactionStatus) => {
        set((state) => {
          const chainTxs = state.transactions[chainId];
          if (!chainTxs || !chainTxs[hash]) return state;

          return {
            transactions: {
              ...state.transactions,
              [chainId]: {
                ...chainTxs,
                [hash]: {
                  ...chainTxs[hash],
                  status,
                },
              },
            },
          };
        });
      },

      getTransaction: (chainId: number, hash: string): Transaction | undefined => {
        return get().transactions[chainId]?.[hash];
      },

      getAllTransactions: (chainId: number, account?: string): Transaction[] => {
        const chainTxs = get().transactions[chainId];
        return chainTxs
          ? Object.values(chainTxs)
              .filter((tx) => !account || !tx.account || tx.account.toLowerCase() === account.toLowerCase())
              .sort((a, b) => b.timestamp - a.timestamp) // newest first
          : [];
      },

      getAllTransactionsByToken: (chainId: number, tokenAddress: string, account?: string): Transaction[] => {
        const chainTxs = get().transactions[chainId];
        return chainTxs
          ? Object.values(chainTxs)
              .filter((tx) => {
                if (!tx.tokenAddress || !tokenAddress) return false;
                if (account && tx.account && tx.account.toLowerCase() !== account.toLowerCase()) return false;
                return tx.tokenAddress.toLowerCase() === tokenAddress.toLowerCase();
              })
              .sort((a, b) => b.timestamp - a.timestamp) // newest first
          : [];
      },

      clearTransactions: (chainId?: number) => {
        set((state) => {
          if (chainId !== undefined) {
            return {
              transactions: {
                ...state.transactions,
                [chainId]: {},
              },
            };
          }
          return { transactions: {} };
        });
      },
    }),
    {
      name: 'cofhe-transaction-store',
      storage: bigintStorage,
    }
  )
);
