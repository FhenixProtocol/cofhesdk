import { useTransactionStore, type Transaction } from '@/stores/transactionStore';
import { useMemo } from 'react';

export function useStoredTransaction(txHash: `0x${string}` | undefined) {
  const allTransactions = useTransactionStore((state) => state.transactions);
  return useMemo(() => {
    if (!txHash) return;
    for (const chainId in allTransactions) {
      const txsOnChain = allTransactions[chainId];
      if (txHash in txsOnChain) {
        return txsOnChain[txHash];
      }
    }
  }, [allTransactions, txHash]);
}
