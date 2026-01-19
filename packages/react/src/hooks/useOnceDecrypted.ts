import type { Transaction } from '@/stores/transactionStore';
import { useStoredTransaction } from './useStoredTransaction';
import { useEffect, useRef } from 'react';

// doesn't perform any RPC calls, uses store as the data source
// executes callback _only once_ when a transaction enters "pending decryption" state
// i.e. it won't fire again if component re-renders etc
export function useOnceDecrypted({
  txHash,
  onceDecrypted,
}: {
  txHash: `0x${string}` | undefined;
  onceDecrypted: (transaction: Transaction) => void;
}) {
  const { transaction } = useStoredTransactionDecryptionEffect({
    txHash,
    onDecryptionPendingChange: (prevIsPendingDecryption, newIsPendingDecryption, transaction) => {
      if (prevIsPendingDecryption === false && newIsPendingDecryption === true) {
        onceDecrypted(transaction);
      }
    },
  });

  return {
    transaction,
    isPendingDecryption: transaction?.isPendingDecryption === true,
  };
}

function useStoredTransactionDecryptionEffect({
  txHash,
  onDecryptionPendingChange,
}: {
  txHash: `0x${string}` | undefined;
  onDecryptionPendingChange: (
    prevIsPendingDecryption: boolean | undefined,
    newIsPendingDecryption: boolean,
    transaction: Transaction
  ) => void;
}) {
  const transaction = useStoredTransaction(txHash);
  const previousTransactionRef = useRef<Transaction | undefined>(undefined);

  useEffect(() => {
    // if flag changed and there's a transaction in the store -- trigger the callback
    if (previousTransactionRef.current?.isPendingDecryption !== transaction?.isPendingDecryption && !!transaction) {
      onDecryptionPendingChange(
        previousTransactionRef.current?.isPendingDecryption,
        transaction.isPendingDecryption,
        transaction
      );

      // update the ref to the latest transaction
      previousTransactionRef.current = transaction;
    }
  }, [onDecryptionPendingChange, transaction]);

  return {
    transaction,
  };
}
