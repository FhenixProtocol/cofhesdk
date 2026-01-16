import { TransactionStatus, useTransactionStore } from '@/stores/transactionStore';
import { useCofheAccount, useCofheChainId } from './useCofheConnection';
import { useMemo } from 'react';

export function usePendingTransactions() {
  const chainId = useCofheChainId();
  const account = useCofheAccount();
  const allTxs = useTransactionStore((state) => (chainId ? state.transactions[chainId] : undefined));

  const accountsPendingTxs = useMemo(() => {
    if (!allTxs || !account) return [];
    return Object.values(allTxs).filter(
      (tx) =>
        tx.status === TransactionStatus.Pending &&
        // TODO: rather change the shape of store, map by account
        tx.account.toLowerCase() === account.toLowerCase()
    );
  }, [account, allTxs]);

  console.log('pendingTxs:', accountsPendingTxs);

  return accountsPendingTxs;
}
