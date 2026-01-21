import { TransactionStatus, useTransactionStore, type Transaction } from '@/stores/transactionStore';
import { useCofheAccount, useCofheChainId } from './useCofheConnection';
import { useCallback, useEffect, useMemo } from 'react';
import { useTransactionReceiptsByHash } from './useTransactionReceiptsByHash';
import { assert } from 'ts-essentials';
import { useCofheReadDecryptionResults } from './useCofheReadDecryptionResults';
import { useInternalQueryClient } from '@/providers';
import { useScheduledInvalidationsStore } from '@/stores/scheduledInvalidationsStore';
import { useStoredTransactions } from './useStoredTransactions';

const filter = (tx: Transaction) => tx.isPendingDecryption && tx.status === TransactionStatus.Confirmed;
export function useTrackDecryptingTransactions() {
  const chainId = useCofheChainId();
  const account = useCofheAccount();

  // step 1: get all mined txs that are pending decryption
  const { hashes, filteredTxsByHash: minedTxsPendingDecryptionByHash } = useStoredTransactions({
    filter,
    account,
    chainId,
  });

  // todo: first check if pending queries cache already has that, might spare a request
  // step 2: get their receipts (to parse logs and find ciphertexts to watch)
  const { receiptsByHash } = useTransactionReceiptsByHash({
    hashes,
  });

  // step 3: from receipts, find ciphertexts to watch
  const minedTxsWithCiphertextsToWatch = useMemo(() => {
    return Object.entries(minedTxsPendingDecryptionByHash).map(([hash, tx]) => {
      const ciphertextToWatch = findDecryptRequestLog(tx.account, receiptsByHash[tx.hash]?.logs)?.ciphertext;
      assert(
        ciphertextToWatch,
        'Ciphertext to watch should be found in the transaction logs if a tx that isPendingDecryption'
      );
      return {
        tx,
        receipt: receiptsByHash[tx.hash],
        ciphertextToWatch,
      };
    });
  }, [minedTxsPendingDecryptionByHash, receiptsByHash]);

  const ciphertextsToWatch = useMemo(() => {
    return new Set(minedTxsWithCiphertextsToWatch.map(({ ciphertextToWatch }) => ciphertextToWatch));
  }, [minedTxsWithCiphertextsToWatch]);

  // step 4: use decryption results polling hook to watch for decryption results
  const decryptionResults = useCofheReadDecryptionResults(ciphertextsToWatch);

  const queryClient = useInternalQueryClient();

  const { setDecryptionObservedAt } = useScheduledInvalidationsStore();

  // step 5: when decryption results arrive, update store and and set decryptionObservedAt info to trigger invalidations
  useEffect(() => {
    const txsWithDecryptionResults = minedTxsWithCiphertextsToWatch.map((item) => ({
      ...item,
      decryptionResult: decryptionResults[item.ciphertextToWatch],
    }));

    for (const { tx, decryptionResult, receipt, ciphertextToWatch } of txsWithDecryptionResults) {
      // update store
      useTransactionStore.getState().setTransactionDecryptionStatus(
        tx.chainId,
        tx.hash,
        false // no longer pending decryption
      );

      console.log('Decryption completed for tx, invalidating relevant queries', {
        tx,
        decryptionResult,
        receipt,
        ciphertextToWatch,
      });
      // before cache invalidation, make sure the request that follows will use up-to-date block number
      setDecryptionObservedAt({
        key: `${tx.actionType}-tx-${tx.hash}`,
        blockNumber: decryptionResult!.observedAt.blockNumber,
        blockHash: decryptionResult!.observedAt.blockHash,
      });
    }
  }, [decryptionResults, queryClient, setDecryptionObservedAt, minedTxsWithCiphertextsToWatch]);

  // step 6: invalidate relevant queries when decryption is observed
  useInvalidateQueriesOnDecryption();
}

function useInvalidateQueriesOnDecryption() {
  const { byKey } = useScheduledInvalidationsStore();
  const queryClient = useInternalQueryClient();

  // step 1: get all query keys that need to be invalidated due to observed decryption
  const allObservedDecryptionQueryKeys = useMemo(() => {
    return Object.values(byKey)
      .filter((item) => item.decryptionObservedAt !== undefined)
      .flatMap((item) => item.queryKeys);
  }, [byKey]);

  console.log('All observed decryption query keys for invalidation:', allObservedDecryptionQueryKeys);

  const invalidate = useCallback(async () => {
    for (const queryKey of allObservedDecryptionQueryKeys) {
      console.log('Invalidating query due to observed decryption:', queryKey);
      await queryClient.invalidateQueries({ queryKey });
    }
  }, [allObservedDecryptionQueryKeys, queryClient]);

  useEffect(() => {
    if (allObservedDecryptionQueryKeys.length > 0) {
      console.log('All observed decryption query keys subject to invalidate:', allObservedDecryptionQueryKeys);
      invalidate();
    }
  }, [allObservedDecryptionQueryKeys, invalidate]);
}

function findDecryptRequestLog(account: string, logs: { topics: string[]; data: string }[] = []) {
  for (const log of logs) {
    const result = safeParseDecryptRequestLog(log, account);
    if (result) return result;
  }
  return undefined;
}

function safeParseDecryptRequestLog(
  log: { topics: string[]; data: string },
  account: string
):
  | false
  | {
      ciphertext: string;
    } {
  const topic0Correct = log.topics[0]
    ?.toLowerCase()
    .startsWith('0xe9de54a3e7ddf0c48cc6e1134185300d5a71acbf2d8c21fcdefa9d9dd9e20ac1');
  const topic1Correct = log.topics[1] === undefined;
  const strippedData = log.data.startsWith('0x') ? log.data.slice(2) : log.data;
  const dataAsWords = strippedData.match(/.{1,64}/g) || [];

  const word1IsCorrect =
    dataAsWords[1]?.toLowerCase() === '00000000000000000000000000000000000000000000000000000000000000a0';
  const word2IsCorrect = dataAsWords[2]?.toLowerCase() === account.toLowerCase().slice(2).padStart(64, '0');
  return topic0Correct && topic1Correct && word1IsCorrect && word2IsCorrect
    ? {
        ciphertext: '0x' + dataAsWords[0],
      }
    : false;
}
