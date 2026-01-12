import {
  TransactionActionType,
  TransactionStatus,
  useTransactionStore,
  type Transaction,
} from '@/stores/transactionStore';
import { useCofheAccount, useCofheChainId, useCofhePublicClient } from './useCofheConnection';
import { useInternalQueries, useInternalQueryClient } from '@/providers';
import { assert } from 'ts-essentials';
import { constructCofheReadContractQueryForInvalidation } from './useCofheReadContract';
import { useMemo } from 'react';
import type { QueriesOptions } from '@tanstack/react-query';
import type { TransactionReceipt } from 'viem';
import { getTokenContractConfig } from '@/constants/confidentialTokenABIs';

export function useTrackPendingTransactions() {
  // Batch check pending transactions using react-query's useQueries
  const chainId = useCofheChainId();
  const account = useCofheAccount();
  const publicClient = useCofhePublicClient();
  const allTxs = useTransactionStore((state) => (chainId ? state.transactions[chainId] : undefined));

  const accountsPendingTxs = useMemo(() => {
    if (!allTxs || !account) return [];
    return Object.values(allTxs).filter(
      (tx) =>
        tx.status === TransactionStatus.Pending &&
        // TODO: rather change the shape of store, map by account
        tx.account.toLowerCase() === account.toLowerCase()
    );
  }, [account, allTxs]);
  const queryClient = useInternalQueryClient();
  console.log('pendingTxs:', accountsPendingTxs);

  const handleInvalidations = (tx: Transaction) => {
    // TODO: add invalidation for the rest of txs
    if (tx.actionType === TransactionActionType.ShieldSend) {
      const tokenBalanceQueryKey = constructCofheReadContractQueryForInvalidation({
        cofheChainId: tx.chainId,
        address: tx.token.address,
        functionName: getTokenContractConfig(tx.token.extensions.fhenix.confidentialityType).functionName,
      });
      console.log('Invalidating shield/send read contract queries for token:', tx.token);

      queryClient.invalidateQueries({
        queryKey: tokenBalanceQueryKey,
        // TODO: it can potentially invalidate irrelevenat queries who happen to belong to the same contract but different function. Not sure if worth fixing
        exact: false,
      });
    }
  };

  const queries: QueriesOptions<TransactionReceipt[]> = accountsPendingTxs.map((tx) => ({
    queryKey: ['tx-receipt', tx.chainId, tx.hash],
    queryFn: async () => {
      assert(publicClient, 'Public client is guaranteed by enabled condition');
      try {
        const receipt = await publicClient.waitForTransactionReceipt({ hash: tx.hash as `0x${string}` });

        const status = receipt.status === 'success' ? TransactionStatus.Confirmed : TransactionStatus.Failed;
        // invalidate if tx was successful
        if (status === TransactionStatus.Confirmed) handleInvalidations(tx);
        useTransactionStore.getState().updateTransactionStatus(tx.chainId, tx.hash, status);

        return receipt;
      } catch (e) {
        // no need to invalidate on failure, since nothing has changed on chain
        useTransactionStore.getState().updateTransactionStatus(tx.chainId, tx.hash, TransactionStatus.Failed);
        throw e;
      }
    },

    enabled: !!publicClient && accountsPendingTxs.length > 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  }));
  useInternalQueries({
    queries,
  });
}
