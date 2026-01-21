import { TransactionStatus, useTransactionStore, type Transaction } from '@/stores/transactionStore';
import { useCofheAccount, useCofheChainId } from './useCofheConnection';
import { useMemo } from 'react';
import { useStoredTransactions } from './useStoredTransactions';

const filter = (tx: Transaction) => tx.status === TransactionStatus.Pending;
export function usePendingTransactions(): Transaction[] {
  const chainId = useCofheChainId();
  const account = useCofheAccount();

  const { filteredTxs } = useStoredTransactions({
    chainId,
    account,
    filter,
  });
  return filteredTxs;
}
