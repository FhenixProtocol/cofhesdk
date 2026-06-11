import { useMemo } from 'react';
import type { ConfidentialToken } from '@/types/token';
import { transactionMatchesToken, type Transaction } from '@/stores/transactionStore';
import { useCofheAccount } from './useCofheConnection';
import { useStoredTransactions } from './useStoredTransactions';

export interface UseCofheTokenTransactionsInput {
  token?: ConfidentialToken;
  accountAddress?: string;
  chainId?: number;
}

export interface UseCofheTokenTransactionsResult {
  transactions: Transaction[];
  hashes: Set<`0x${string}`>;
  transactionsByHash: Record<`0x${string}`, Transaction>;
}

export function useCofheTokenTransactions({
  token,
  accountAddress,
  chainId,
}: UseCofheTokenTransactionsInput): UseCofheTokenTransactionsResult {
  const connectedAccount = useCofheAccount();
  const account = accountAddress ?? connectedAccount;
  const tokenAddress = token?.address;

  const filter = useMemo(() => {
    if (!tokenAddress) return () => false;
    return (tx: Transaction) => transactionMatchesToken(tx, tokenAddress);
  }, [tokenAddress]);

  const { filteredTxs } = useStoredTransactions({
    chainId: chainId ?? token?.chainId,
    account,
    filter,
  });

  const transactions = useMemo(() => {
    return filteredTxs.slice().sort((left, right) => right.timestamp - left.timestamp);
  }, [filteredTxs]);

  const hashes = useMemo(() => new Set(transactions.map((tx) => tx.hash)), [transactions]);

  const transactionsByHash = useMemo(
    () =>
      transactions.reduce<Record<`0x${string}`, Transaction>>((acc, tx) => {
        acc[tx.hash] = tx;
        return acc;
      }, {}),
    [transactions]
  );

  return {
    transactions,
    hashes,
    transactionsByHash,
  };
}
