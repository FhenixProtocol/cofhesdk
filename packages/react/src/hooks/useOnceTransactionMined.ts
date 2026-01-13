import type { Transaction, TransactionStatus } from '@/stores/transactionStore';
import { useStoredTransaction } from './useStoredTransaction';
import { useEffect, useRef } from 'react';

// doesn't perform any RPC calls, uses store as the data source
// executes callback _only once_ when transaction is mined (i.e. goes from pending to final status - confirmed/failed)
// i.e. it wont fire again if component re-renders or transaction status changes again (which shouldn't ever happen unless exception, as it's final data from the chain)

// use this hook for ad-hock UI effects that should happen once tx is mined (e.g. show a toast, navigate, etc)
// DO NOT use this hook for balance invalidation as it's handled in useTrackPendingTransactions
export function useOnceTransactionMined({
  txHash,
  onceMined,
}: {
  txHash: `0x${string}` | undefined;
  onceMined: (transaction: Transaction) => void;
}) {
  const { transaction } = useStoredTransactionStatusEffect({
    txHash,
    onTransactionStatusChange: (prevStatus, newStatus, transaction) => {
      if (prevStatus === 'pending' && (newStatus === 'confirmed' || newStatus === 'failed')) {
        onceMined(transaction);
      }
    },
  });

  return {
    transaction,
    isMining: transaction?.status === 'pending',
  };
}

function useStoredTransactionStatusEffect({
  txHash,
  onTransactionStatusChange,
}: {
  txHash: `0x${string}` | undefined;
  onTransactionStatusChange: (
    prevStatus: TransactionStatus | undefined,
    newStatus: TransactionStatus,
    transaction: Transaction
  ) => void;
}) {
  const transaction = useStoredTransaction(txHash);
  const previousTransactionRef = useRef<Transaction | undefined>(undefined);

  useEffect(() => {
    // if status changed and there's a transaction in the store -- trigger the callback
    if (previousTransactionRef.current?.status !== transaction?.status && !!transaction) {
      onTransactionStatusChange(previousTransactionRef.current?.status, transaction.status, transaction);

      // update the ref to the latest transaction
      previousTransactionRef.current = transaction;
    }
  }, [onTransactionStatusChange, transaction]);

  return {
    transaction,
  };
}
