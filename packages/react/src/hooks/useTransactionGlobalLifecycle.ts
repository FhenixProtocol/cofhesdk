import type { DecryptionWatcher } from '@/stores/decryptionWatchingStore';
import type { Transaction } from '@/stores/transactionStore';
import type { TransactionReceipt } from 'viem';

export function useTransactionGlobalLifecycle() {
  return {
    // 1.tx is submitted
    onTransactionSubmitted: (transaction: Transaction) => {
      console.log('____ Transaction submitted:', transaction);
    },

    // 2.a. tx is mined (could be success or fail)
    onTransactionMined: (transaction: Transaction, receipt: TransactionReceipt /*  could be fail or success */) => {
      console.log('____ Transaction mined:', transaction, 'with receipt:', receipt);
    },
    // 2.b. tx receipt fetch failed
    onWatchReceiptFailure: (error: unknown, transaction: Transaction) => {
      console.error('____ Transaction receipt fetch failed for tx:', transaction, 'with error:', error);
    },

    // 3. tx is decrypted (if applicable)
    onTransactionDecrypted: (decryptionCausingTx: Transaction, decryptionWatcher: DecryptionWatcher) => {
      console.log('____ Transaction decrypted:', decryptionCausingTx, 'with watcher:', decryptionWatcher);
    },
  };
}
