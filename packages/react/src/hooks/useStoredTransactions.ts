import { useTransactionStore, type Transaction } from '@/stores/transactionStore';
import { useMemo } from 'react';
import { assert } from 'ts-essentials';

export function useStoredTransactions<T>({
  chainId,
  account,
  filter,
  reducer,
}: {
  chainId?: number;
  account?: string;
  filter?: (tx: Transaction) => boolean;
  reducer?: (txs: Transaction[]) => T;
}) {
  const transactions = useTransactionStore((state) => state.transactions);

  const transactionsAsArray = useMemo(
    () =>
      Object.values(
        chainId
          ? // if chainId provided -- will filter on chain's txs first
            transactions[chainId] ?? {}
          : // if chainId not provided -- will filter on all txs
            Object.values(transactions).flatMap((chainTxs) => Object.values(chainTxs))
      ),
    [transactions, chainId]
  );

  const filtered = useMemo(
    () =>
      transactionsAsArray.filter((tx) => {
        if (account && tx.account.toLowerCase() !== account.toLowerCase()) return false;

        if (filter && !filter(tx)) return false;

        return true;
      }),
    [transactionsAsArray, filter, account]
  );

  const reduced = useMemo(() => {
    return reducer?.(filtered);
  }, [filtered, reducer]);

  const uniqueHashes = new Set(filtered.map((tx) => tx.hash));

  assert(
    uniqueHashes.size === filtered.length,
    'There should be no duplicate transactions with the same hash in the result'
  );

  const filteredTxsByHash = useMemo(
    () =>
      filtered.reduce<Record<`0x${string}`, Transaction>>((acc, tx) => {
        return {
          ...acc,
          [tx.hash]: tx,
        };
      }, {}),
    [filtered]
  );
  return {
    filteredTxs: filtered,
    hashes: uniqueHashes,
    filteredTxsByHash,
    reduced,
  };
}
