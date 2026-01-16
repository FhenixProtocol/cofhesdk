import { useTransactionStore, type Transaction } from '@/stores/transactionStore';
import { useCofheAccount, useCofheChainId } from './useCofheConnection';
import { useEffect, useMemo } from 'react';

export function useTrackDecryptingTransactions() {
  const chainId = useCofheChainId();
  const account = useCofheAccount();
  const allTxs = useTransactionStore((state) => (chainId ? state.transactions[chainId] : undefined));

  const decryptingTransactionsByHash = useMemo(() => {
    if (!allTxs || !account) return [];
    const decryptionTxs = Object.values(allTxs).filter(
      (tx) =>
        tx.isPendingDecryption &&
        // TODO: rather change the shape of store, map by account
        tx.account.toLowerCase() === account.toLowerCase()
    );
    return decryptionTxs.reduce<Record<string, Transaction>>((acc, tx) => {
      acc[tx.hash] = tx;
      return acc;
    }, {});
  }, [account, allTxs]);

  // console.log('decryptingTxs:', decryptingTransactionsByHash);

  // useEffect(() => {}, [decryptingTransactionsByHash]);
}
