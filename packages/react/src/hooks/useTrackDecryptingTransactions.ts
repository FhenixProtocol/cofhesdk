import {
  TransactionActionType,
  TransactionStatus,
  useTransactionStore,
  type Transaction,
} from '@/stores/transactionStore';
import { useCofheAccount, useCofheChainId } from './useCofheConnection';
import { useCallback, useEffect, useMemo } from 'react';
import { useTransactionReceiptsByHash } from './useTransactionReceiptsByHash';
import { assert } from 'ts-essentials';
import { useCofheReadDecryptionResults } from './useCofheReadDecryptionResults';
import { invalidateClaimableQueries } from './useCofheTokenClaimable';
import { useInternalQueryClient } from '@/providers';
import { setDecryptionTrackedBlock } from './decryptionTracking';

export function useTrackDecryptingTransactions() {
  //tmp
  // useResetPendingDecryption();
  const chainId = useCofheChainId();
  const account = useCofheAccount();
  const allTxs = useTransactionStore((state) => (chainId ? state.transactions[chainId] : undefined));

  const decryptingTransactionsByHash = useMemo(() => {
    if (!allTxs || !account) return [];
    const decryptionTxs = Object.values(allTxs).filter(
      (tx) =>
        tx.isPendingDecryption &&
        tx.status === TransactionStatus.Confirmed &&
        // TODO: rather change the shape of store, map by account
        tx.account.toLowerCase() === account.toLowerCase()
    );
    const result = decryptionTxs.reduce<Record<`0x${string}`, Transaction>>((acc, tx) => {
      acc[tx.hash] = tx;
      return acc;
    }, {});
    return result;
  }, [account, allTxs]);

  console.log('decryptingTransactionsByHash:', decryptingTransactionsByHash);
  // todo: first check if pending queries cache already has that, might spare a request
  const { receiptsByHash } = useTransactionReceiptsByHash({
    hashes: Object.keys(decryptingTransactionsByHash),
  });

  const combinedWithDecryptionRequests = useMemo(() => {
    return Object.entries(decryptingTransactionsByHash).map(([hash, tx]) => {
      const receipt = receiptsByHash[tx.hash];
      const decryptRequestLogs = receipt?.logs
        .filter((log) => isDecryptRequestLog(log, tx.account))
        .map((log) => isDecryptRequestLog(log, tx.account));

      if (decryptRequestLogs !== undefined) {
        assert(
          decryptRequestLogs?.length === 1,
          'There should be exactly one decrypt request log per decrypting transaction'
        );
      }

      const ciphertextToWatch =
        (decryptRequestLogs && decryptRequestLogs[0] && decryptRequestLogs[0].ciphertext) || undefined;

      return {
        tx,
        receipt,
        ciphertextToWatch,
      };
    });
  }, [decryptingTransactionsByHash, receiptsByHash]);
  console.log('combinedWithDecryptionRequests:', combinedWithDecryptionRequests);

  const ciphertextsToWatch = useMemo(() => {
    return combinedWithDecryptionRequests.map((item) => item.ciphertextToWatch).filter((ct) => ct !== undefined);
  }, [combinedWithDecryptionRequests]);
  const decryptionResults = useCofheReadDecryptionResults(ciphertextsToWatch);

  const queryClient = useInternalQueryClient();

  const handleInvalidations = useCallback(
    (tx: Transaction) => {
      // invalidate claimable queries as decrypting a transaction means that unshield claims are now available
      if (tx.actionType === TransactionActionType.Unshield) {
        // TODO: still doesn't work correctly. Enfroce lastBlockHash?
        invalidateClaimableQueries({
          token: tx.token,
          accountAddress: tx.account,

          queryClient,
        });
      }
    },
    [queryClient]
  );

  useEffect(() => {
    const newlyDecrypted = combinedWithDecryptionRequests
      .map((item) => {
        const decryptionResult =
          item.ciphertextToWatch !== undefined ? decryptionResults[item.ciphertextToWatch] : undefined;
        return {
          ...item,
          decryptionResult,
        };
      })
      .filter((item) => item.decryptionResult !== undefined);

    for (const item of newlyDecrypted) {
      // update store
      useTransactionStore.getState().setTransactionDecryptionStatus(
        item.tx.chainId,
        item.tx.hash,
        false // no longer pending decryption
      );

      // before cache invalidation, make sure the request that follows will use up-to-date block number
      setDecryptionTrackedBlock(
        queryClient,
        {
          chainId: item.tx.chainId,
          accountAddress: item.tx.account,
        },
        item.receipt?.blockNumber
      );
      handleInvalidations(item.tx);
    }
  }, [combinedWithDecryptionRequests, decryptionResults, handleInvalidations, queryClient]);
}

// function useResetPendingDecryption() {
//   const chainId = useCofheChainId();
//   const account = useCofheAccount();
//   const allTxs = useTransactionStore((state) => (chainId ? state.transactions[chainId] : undefined));

//   const resetFn = () => {
//     if (!allTxs) return;
//     const txs = Object.values(allTxs);

//     for (const tx of txs) {
//       if (tx.isPendingDecryption === false) {
//         useTransactionStore.getState().setTransactionDecryptionStatus(tx.chainId, tx.hash, true);
//       }
//     }
//   };

//   (window as any).resetFn = resetFn;
// }

function isDecryptRequestLog(
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
