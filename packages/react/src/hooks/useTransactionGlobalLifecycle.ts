import { usePortalToasts } from '@/stores';
import type { DecryptionWatcher } from '@/stores/decryptionWatchingStore';
import type { Transaction } from '@/stores/transactionStore';
import type { TransactionReceipt } from 'viem';

const TOAST_DELAY_MS = 10_000;
function useTransactionGlobalToastsLifecycle() {
  const { addToast } = usePortalToasts();
  return {
    // 1.tx is submitted
    onTransactionSubmitted: (transaction: Transaction) => {
      console.log('____ Transaction submitted:', transaction);
      addToast(
        {
          variant: 'info',
          title: `${transaction.actionType}  Transaction Submitted`,
          description: `${transaction.actionType} transaction has been submitted.`,
          transaction: {
            hash: transaction.hash,
            chainId: transaction.chainId,
          },
        },
        TOAST_DELAY_MS
      );
    },
    onTransactionSubmitError: (error: unknown, transactionType: Transaction['actionType']) => {
      console.error('____ Transaction submission failed for type:', transactionType, 'with error:', error);
      addToast(
        {
          variant: 'error',
          title: `${transactionType} Transaction Submission Failed`,
          description:
            error instanceof Error ? error.message : 'An unknown error occurred during transaction submission.',
        },
        TOAST_DELAY_MS
      );
    },

    // 2.a. tx is mined (could be success or fail)
    onTransactionMined: (transaction: Transaction, receipt: TransactionReceipt /*  could be fail or success */) => {
      console.log('____ Transaction mined:', transaction, 'with receipt:', receipt);
      if (receipt.status === 'success') {
        const descriptionPostfix = transaction.isPendingDecryption ? ' It is pending decryption now.' : '';
        addToast(
          {
            variant: transaction.isPendingDecryption ? 'info' : 'success', // if pending decryption, show as info
            title: `${transaction.actionType} Transaction Mined`,
            description: `${transaction.actionType} transaction has been mined.${descriptionPostfix}`,
            transaction: {
              hash: transaction.hash,
              chainId: transaction.chainId,
            },
          },
          TOAST_DELAY_MS
        );
      } else {
        addToast(
          {
            variant: 'error',
            title: `${transaction.actionType} Transaction Failed`,
            description: `${transaction.actionType} transaction has failed.`,
            transaction: {
              hash: transaction.hash,
              chainId: transaction.chainId,
            },
          },
          TOAST_DELAY_MS
        );
      }
    },
    // 2.b. tx receipt fetch failed
    onWatchReceiptFailure: (error: unknown, transaction: Transaction) => {
      console.error('____ Transaction receipt fetch failed for tx:', transaction, 'with error:', error);
      addToast(
        {
          variant: 'error',
          title: `${transaction.actionType} Transaction Fetch Failed`,
          description: `Fetching ${transaction.actionType} transaction has failed.`,
          transaction: {
            hash: transaction.hash,
            chainId: transaction.chainId,
          },
        },
        TOAST_DELAY_MS
      );
    },

    // 3. tx is decrypted (if applicable)
    onTransactionDecrypted: (decryptionCausingTx: Transaction, decryptionWatcher: DecryptionWatcher) => {
      console.log('____ Transaction decrypted:', decryptionCausingTx, 'with watcher:', decryptionWatcher);
      addToast(
        {
          variant: 'success',
          title: `${decryptionCausingTx.actionType} Decryption Succeeded`,
          description: `${decryptionCausingTx.actionType} transaction has been decrypted.`,
          transaction: {
            hash: decryptionCausingTx.hash,
            chainId: decryptionCausingTx.chainId,
          },
        },
        TOAST_DELAY_MS
      );
    },
  };
}

export function useTransactionGlobalLifecycle() {
  const {
    onTransactionSubmitted: handleToastsOnTransactionSubmitted,
    onTransactionMined: handleToastsOnTransactionMined,
    onWatchReceiptFailure: handleToastsOnWatchReceiptFailure,
    onTransactionDecrypted: handleToastsOnTransactionDecrypted,
    onTransactionSubmitError: handleToastsOnTransactionSubmitError,
  } = useTransactionGlobalToastsLifecycle();

  // You can add more lifecycle handlers here in the future if needed. For now only toasts. Cache invalidations are built-in in other, lower-level hooks.
  return {
    onTransactionSubmitted: handleToastsOnTransactionSubmitted,
    onTransactionMined: handleToastsOnTransactionMined,
    onWatchReceiptFailure: handleToastsOnWatchReceiptFailure,
    onTransactionDecrypted: handleToastsOnTransactionDecrypted,
    onTransactionSubmitError: handleToastsOnTransactionSubmitError,
  };
}
