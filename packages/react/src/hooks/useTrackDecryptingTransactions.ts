import { TransactionStatus, useTransactionStore, type Transaction } from '@/stores/transactionStore';
import { useCofheAccount, useCofheChainId } from './useCofheConnection';
import { useMemo } from 'react';
import { useTransactionReceiptsByHash } from './useTransactionReceiptsByHash';
import { assert } from 'ts-essentials';

export function useTrackDecryptingTransactions() {
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

  const combined = useMemo(() => {
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
  console.log('combined:', combined);
  // TODO: proper solution:
  // 1. notice events emitted by (TASK_MANAGER_ADDRESS).createDecryptTask(input, msg.sender);
  // 2. identify their CT // topic: 0xe9de54a3e7ddf0c48cc6e1134185300d5a71acbf2d8c21fcdefa9d9dd9e20ac1 data: [ciphertext, 00000...000xa0, requestor, ...restOfStuff]
  // 3. listen for completion events on task manager topic = topic = 0x023b156100bf14eedc41deb8cef114c1fce662c306697f3bfaf3dbca58130bf7 topic1 = ACL user address (from) data: [ciphertext, second argument (amount to be decrypted)]
  // 4. once found decryption event for that CT -> mark transaction as decrypted in the store

  // console.log('decryptingTxs:', decryptingTransactionsByHash);

  // useEffect(() => {}, [decryptingTransactionsByHash]);
}

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
