import type { Token } from '@/types/token';
import { bigintJSONStorageOptions } from '@/utils/bigintJson';
import type { Address } from 'viem';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

type ChainRecord<T> = Record<number, T>;
type HashRecord<T> = Record<string, T>;

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export enum TransactionStatus {
  Pending = 'pending',
  Failed = 'failed',
  Confirmed = 'confirmed',
}
export type TransactionStatusString = 'Pending' | 'Failed' | 'Confirmed';

export enum TransactionActionType {
  ShieldSend = 'shieldSend',
  Shield = 'shield',
  Unshield = 'unshield',
  Claim = 'claim',
}
export type TransactionActionString = 'Shielded Transfer' | 'Shield' | 'Unshield' | 'Claim';

type BaseTransaction = {
  hash: `0x${string}`;
  status: TransactionStatus;
  timestamp: number;
  chainId: number;
  // actionType: Exclude<TransactionActionType, TransactionActionType.Unshield>;
  account: Address;

  token: Token;
  //

  tokenAmount: bigint;
  isPendingDecryption: boolean;
};

type ShieldingTransaction = BaseTransaction & {
  actionType: TransactionActionType.Shield;
};
type SendingTransaction = BaseTransaction & {
  actionType: TransactionActionType.ShieldSend;
};
type ClaimingTransaction = BaseTransaction & {
  actionType: TransactionActionType.Claim;
};

type UnshieldingTransaction = BaseTransaction & {
  actionType: TransactionActionType.Unshield;
};

export type Transaction = UnshieldingTransaction | ShieldingTransaction | SendingTransaction | ClaimingTransaction;

type NewTransaction = DistributiveOmit<Transaction, 'status' | 'timestamp'>;

export interface TransactionStore {
  // TODO: should be chainId -> account -> txHash -> Transaction
  transactions: ChainRecord<HashRecord<Transaction>>;
  addTransaction: (transaction: NewTransaction) => void;
  getTransaction: (chainId: number, hash: string) => Transaction | undefined;
  getAllTransactions: (chainId: number, account?: string) => Transaction[];
  getAllTransactionsByToken: (chainId: number, tokenAddress: string, account?: string) => Transaction[];
  updateTransactionStatus: (chainId: number, hash: string, status: TransactionStatus) => void;
  setTransactionDecryptionStatus: (chainId: number, hash: string, isPendingDecryption: boolean) => void;
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

// Custom storage to handle bigint serialization
const bigintStorage = createJSONStorage<TransactionStore>(() => localStorage, bigintJSONStorageOptions);

function constructNewTx(transaction: NewTransaction): Transaction {
  return {
    ...transaction,
    status: TransactionStatus.Pending,
    timestamp: Date.now(),
  };
}

export const useTransactionStore = create<TransactionStore>()(
  persist(
    (set, get) => ({
      transactions: {},

      addTransaction: (transaction: NewTransaction) => {
        set((state) => {
          const chainTxs = state.transactions[transaction.chainId] || {};
          const pendingTx = constructNewTx(transaction);
          return {
            transactions: {
              ...state.transactions,
              [transaction.chainId]: {
                ...chainTxs,
                [transaction.hash]: pendingTx,
              },
            },
          };
        });
      },

      setTransactionDecryptionStatus: (chainId: number, hash: string, isPendingDecryption: boolean) => {
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
                  isPendingDecryption,
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
                  // if tx failed, it's no longer pending decryption
                  isPendingDecryption: status === TransactionStatus.Failed ? false : chainTxs[hash].isPendingDecryption,
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
                return tx.account.toLowerCase() === account?.toLowerCase();
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
