import { TransactionActionType, TransactionStatus, type Transaction } from '@/stores/transactionStore';
import { useCofheAccount } from './useCofheConnection';
import type { Token } from './useCofheTokenLists';
import { useStoredTransactions } from './useStoredTransactions';
import { useCallback } from 'react';

export function useIsUnshieldingMining(token: Token) {
  const account = useCofheAccount();
  const filter = useCallback(
    (tx: Transaction) => {
      return (
        tx.token.address === token.address &&
        tx.actionType === TransactionActionType.Unshield &&
        tx.status === TransactionStatus.Pending
      );
    },
    [token.address]
  );
  const allPendingTxs = useStoredTransactions({
    chainId: token.chainId,
    account,
    filter,
  });

  return allPendingTxs.filteredTxs.length > 0;
}
