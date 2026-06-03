import type { Token } from '@/types/token';
import { bigintJSONStorageOptions } from '@/utils/bigintJson';
import type { Address, TransactionReceipt } from 'viem';
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

export const TransactionActionType = {
  ShieldSend: 'shieldSend',
  Shield: 'shield',
  Unshield: 'unshield',
  Claim: 'claim',
  Approve: 'approve',
} as const;

export type BuiltInTransactionActionType = (typeof TransactionActionType)[keyof typeof TransactionActionType];
export type CustomTransactionActionType = `custom-${string}`;
export type TransactionActionType = BuiltInTransactionActionType | CustomTransactionActionType;
export type TransactionActionString = 'Shielded Transfer' | 'Shield' | 'Unshield' | 'Claim' | 'Approve' | string;

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

type BaseTransaction = {
  hash: `0x${string}`;
  receipt?: TransactionReceipt;
  status: TransactionStatus;
  timestamp: number;
  chainId: number;
  account: Address;

  /**
   * Action identifier. For custom transactions this must be `custom-${string}` and also serves as the
   * renderer lookup key.
   */
  actionType: TransactionActionType;
  title?: string;
  description?: string;
  tokenTags?: `0x${string}`[];
  payload?: JsonValue;
};

type TokenTransaction = BaseTransaction & {
  token: Token;
  tokenAmount: bigint;
};

type ShieldingTransaction = TokenTransaction & {
  actionType: typeof TransactionActionType.Shield;
};
type SendingTransaction = TokenTransaction & {
  actionType: typeof TransactionActionType.ShieldSend;
};
type ClaimingTransaction = TokenTransaction & {
  actionType: typeof TransactionActionType.Claim;
};

type ApprovingTransaction = TokenTransaction & {
  actionType: typeof TransactionActionType.Approve;
};

type UnshieldingTransaction = TokenTransaction & {
  actionType: typeof TransactionActionType.Unshield;
};

type CustomTransaction = BaseTransaction & {
  actionType: CustomTransactionActionType;
};

export type Transaction =
  | UnshieldingTransaction
  | ShieldingTransaction
  | SendingTransaction
  | ClaimingTransaction
  | ApprovingTransaction
  | CustomTransaction;

export type NewTransaction = DistributiveOmit<Transaction, 'status' | 'timestamp'>;

export interface TransactionStore {
  // TODO: should be chainId -> account -> txHash -> Transaction
  transactions: ChainRecord<HashRecord<Transaction>>;
  addTransaction: (transaction: NewTransaction) => void;
  getTransaction: (chainId: number, hash: string) => Transaction | undefined;
  getAllTransactions: (chainId: number, account?: string) => Transaction[];
  getAllTransactionsByToken: (chainId: number, tokenAddress: string, account?: string) => Transaction[];
  updateTransactionStatus: (
    chainId: number,
    hash: string,
    status: TransactionStatus,
    minedData?: { receipt?: TransactionReceipt }
  ) => void;
  clearTransactions: (chainId?: number) => void;
}

const actionToStringMap: Record<BuiltInTransactionActionType, TransactionActionString> = {
  [TransactionActionType.ShieldSend]: 'Shielded Transfer',
  [TransactionActionType.Shield]: 'Shield',
  [TransactionActionType.Unshield]: 'Unshield',
  [TransactionActionType.Claim]: 'Claim',
  [TransactionActionType.Approve]: 'Approve',
};

export const actionToString = (a: TransactionActionType, fallbackTitle?: string): TransactionActionString =>
  actionToStringMap[a as BuiltInTransactionActionType] ?? fallbackTitle ?? a;

export const isCustomTransactionActionType = (
  actionType: TransactionActionType
): actionType is CustomTransactionActionType => actionType.startsWith('custom-');

const statusToStringMap: Record<TransactionStatus, TransactionStatusString> = {
  [TransactionStatus.Pending]: 'Pending',
  [TransactionStatus.Failed]: 'Failed',
  [TransactionStatus.Confirmed]: 'Confirmed',
};

export const statusToString = (a: TransactionStatus): TransactionStatusString => statusToStringMap[a];

function normalizeAddressList(addresses: readonly `0x${string}`[] | undefined): `0x${string}`[] | undefined {
  if (!addresses || addresses.length === 0) return undefined;

  return Array.from(new Set(addresses.map((address) => address.toLowerCase() as `0x${string}`)));
}

function transactionMatchesToken(tx: Transaction, tokenAddress: string): boolean {
  const normalizedTokenAddress = tokenAddress.toLowerCase();
  if ('token' in tx && tx.token.address.toLowerCase() === normalizedTokenAddress) return true;

  return tx.tokenTags?.some((tag) => tag.toLowerCase() === normalizedTokenAddress) ?? false;
}

// Custom storage to handle bigint serialization
const bigintStorage = createJSONStorage<TransactionStore>(() => localStorage, bigintJSONStorageOptions);

function constructNewTx(transaction: NewTransaction): Transaction {
  const tokenTags = normalizeAddressList([
    ...(transaction.tokenTags ?? []),
    ...('token' in transaction ? [transaction.token.address as `0x${string}`] : []),
  ]);

  return {
    ...transaction,
    ...(tokenTags ? { tokenTags } : {}),
    status: TransactionStatus.Pending,
    timestamp: Date.now(),
  } as Transaction;
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

      updateTransactionStatus: (
        chainId: number,
        hash: string,
        status: TransactionStatus,
        minedData?: { receipt?: TransactionReceipt }
      ) => {
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
                  receipt: minedData?.receipt ?? chainTxs[hash].receipt,
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
                if (!transactionMatchesToken(tx, tokenAddress)) return false;
                return !account || tx.account.toLowerCase() === account.toLowerCase();
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
