import { usePortalToasts } from '@/stores';
import type { Transaction } from '@/stores/transactionStore';
import { ContractFunctionExecutionError, ContractFunctionRevertedError, type TransactionReceipt } from 'viem';
import { cofheHumanizeRevertReason } from '@/utils/cofheErrors';
import { cofheLogger } from '@/utils/debug';

const TOAST_DELAY_MS = 10_000;
function useTransactionGlobalToastsLifecycle() {
  const { addToast } = usePortalToasts();
  return {
    // 1.tx is submitted
    onTransactionSubmitted: (transaction: Transaction) => {
      cofheLogger.log('____ Transaction submitted:', transaction);
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
      let humanReadableError: string | undefined;
      if (error instanceof ContractFunctionExecutionError) {
        if (error.cause instanceof ContractFunctionRevertedError) {
          const reasonOfRevert = error.cause.raw;
          if (typeof reasonOfRevert === 'string') {
            humanReadableError = cofheHumanizeRevertReason(reasonOfRevert);
          }
        }
      }
      cofheLogger.error('____ Transaction submission failed for type:', transactionType, 'with error:', error);
      addToast(
        {
          variant: 'error',
          title: `${transactionType} Transaction Submission Failed`,
          description:
            humanReadableError ??
            (error instanceof Error ? error.message : 'An unknown error occurred during transaction submission.'),
        },
        TOAST_DELAY_MS
      );
    },

    // 2.a. tx is mined (could be success or fail)
    onTransactionMined: (transaction: Transaction, receipt: TransactionReceipt /*  could be fail or success */) => {
      cofheLogger.log('____ Transaction mined:', transaction, 'with receipt:', receipt);
      if (receipt.status === 'success') {
        addToast(
          {
            variant: 'success',
            title: `${transaction.actionType} Transaction Mined`,
            description: `${transaction.actionType} transaction has been mined.`,
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
      cofheLogger.error('____ Transaction receipt fetch failed for tx:', transaction, 'with error:', error);
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
  };
}

export function useTransactionGlobalLifecycle() {
  const {
    onTransactionSubmitted: handleToastsOnTransactionSubmitted,
    onTransactionMined: handleToastsOnTransactionMined,
    onWatchReceiptFailure: handleToastsOnWatchReceiptFailure,
    onTransactionSubmitError: handleToastsOnTransactionSubmitError,
  } = useTransactionGlobalToastsLifecycle();

  // You can add more lifecycle handlers here in the future if needed. For now only toasts. Cache invalidations are built-in in other, lower-level hooks.
  return {
    onTransactionSubmitted: handleToastsOnTransactionSubmitted,
    onTransactionMined: handleToastsOnTransactionMined,
    onWatchReceiptFailure: handleToastsOnWatchReceiptFailure,
    onTransactionSubmitError: handleToastsOnTransactionSubmitError,
  };
}
