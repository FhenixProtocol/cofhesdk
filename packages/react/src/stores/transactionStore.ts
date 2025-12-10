import { create, type StoreApi, type UseBoundStore } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

type ChainRecord<T> = Record<number, T>;
type HashRecord<T> = Record<string, T>;

export enum TransactionStatus {
  Pending = 0,
  Failed = 1,
  Confirmed = 2,
}
export type TransactionStatusString = 'Pending' | 'Failed' | 'Confirmed';

export enum TransactionActionType {
  ShieldSend = 0,
  Shield = 1,
  Unshield = 2,
}
export type TransactionActionString = 'Shielded Transfer' | 'Shield' | 'Unshield';

export interface Transaction {
  hash: string;
  status: TransactionStatus;
  tokenSymbol: string;
  tokenAmount: bigint;
  tokenDecimals: number;
  tokenAddress: string;
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

export const useTransactionStore: UseBoundStore<StoreApi<TransactionStore>> = create<TransactionStore>()(
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

// Pending transaction polling
let pendingTransactionInterval: ReturnType<typeof setInterval> | null = null;

// Type for public client (minimal interface needed)
type MinimalPublicClient = {
  getTransactionReceipt: (args: { hash: `0x${string}` }) => Promise<{ status: 'success' | 'reverted' } | null>;
  waitForTransactionReceipt?: (args: { hash: `0x${string}` }) => Promise<{ status: 'success' | 'reverted' }>;
};

type PublicClientGetter = (chainId: number) => MinimalPublicClient | null | undefined;

/**
 * Add a transaction and watch for its confirmation in background
 * @param transaction - Transaction data (without status and timestamp)
 * @param publicClient - Public client to watch for confirmation (optional)
 * @param enabled - Whether recording is enabled (default: false)
 */
export const addTransactionAndWatch = (
  transaction: Omit<Transaction, 'status' | 'timestamp'>,
  publicClient?: MinimalPublicClient | null,
  enabled = false
): void => {
  if (!enabled) return;

  const { addTransaction, updateTransactionStatus } = useTransactionStore.getState();

  // Add transaction to store
  addTransaction(transaction);

  // Watch for confirmation in background
  if (publicClient?.waitForTransactionReceipt) {
    publicClient
      .waitForTransactionReceipt({ hash: transaction.hash as `0x${string}` })
      .then((receipt) => {
        const status = receipt.status === 'success' ? TransactionStatus.Confirmed : TransactionStatus.Failed;
        updateTransactionStatus(transaction.chainId, transaction.hash, status);
      })
      .catch(() => {
        updateTransactionStatus(transaction.chainId, transaction.hash, TransactionStatus.Failed);
      });
  }
};

// Function to check specific pending transactions
const checkSpecificPendingTransactions = async (
  transactions: Transaction[],
  getPublicClient: PublicClientGetter
): Promise<Transaction[]> => {
  const stillPending: Transaction[] = [];

  for (const tx of transactions) {
    try {
      const publicClient = getPublicClient(tx.chainId);
      if (!publicClient) {
        stillPending.push(tx);
        continue;
      }

      const receipt = await publicClient.getTransactionReceipt({ hash: tx.hash as `0x${string}` });

      if (receipt) {
        const status = receipt.status === 'success' ? TransactionStatus.Confirmed : TransactionStatus.Failed;
        useTransactionStore.getState().updateTransactionStatus(tx.chainId, tx.hash, status);
      } else {
        stillPending.push(tx);
      }
    } catch {
      // Transaction not found or error - keep as pending
      stillPending.push(tx);
    }
  }

  return stillPending;
};

// Function to stop pending transaction polling (useful for cleanup)
export const stopPendingTransactionPolling = (): void => {
  if (pendingTransactionInterval) {
    clearInterval(pendingTransactionInterval);
    pendingTransactionInterval = null;
  }
};

// Function to check all pending transactions - call this on app load
export const checkPendingTransactions = async (getPublicClient: PublicClientGetter): Promise<void> => {
  // Clear any existing interval
  stopPendingTransactionPolling();

  // Get all pending transactions from store
  const state = useTransactionStore.getState();
  const pendingTransactions: Transaction[] = [];

  Object.values(state.transactions).forEach((chainTxs) => {
    Object.values(chainTxs).forEach((tx) => {
      if (tx.status === TransactionStatus.Pending) {
        pendingTransactions.push(tx);
      }
    });
  });

  if (pendingTransactions.length === 0) {
    return;
  }

  // Check transactions initially
  let stillPending = await checkSpecificPendingTransactions(pendingTransactions, getPublicClient);

  // Set up 10-second polling for remaining pending transactions
  if (stillPending.length > 0) {
    pendingTransactionInterval = setInterval(async () => {
      stillPending = await checkSpecificPendingTransactions(stillPending, getPublicClient);

      // If no more pending transactions, stop polling
      if (stillPending.length === 0) {
        stopPendingTransactionPolling();
      }
    }, 10000); // 10 seconds
  }
};
