import { type Transaction } from '@/stores/transactionStore';
import { useMemo } from 'react';
import { useStoredTransactions } from './useStoredTransactions';
import { assert } from 'ts-essentials';

export function useStoredTransaction(txHash: `0x${string}` | undefined) {
  const filter = useMemo(() => {
    return (tx: Transaction) => tx.hash === txHash;
  }, [txHash]);
  const { filteredTxs } = useStoredTransactions({ filter });
  assert(filteredTxs.length <= 1, 'There should be at most one transaction with a given hash');

  return filteredTxs[0];
}
