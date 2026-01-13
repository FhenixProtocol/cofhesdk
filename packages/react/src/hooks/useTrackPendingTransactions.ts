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
import type { QueriesOptions, QueryClient } from '@tanstack/react-query';
import type { Address, TransactionReceipt } from 'viem';
import { getTokenContractConfig } from '@/constants/confidentialTokenABIs';
import type { Token } from './useCofheTokenLists';
import { constructPublicTokenBalanceQueryKeyForInvalidation } from './useCofheTokenPublicBalance';

function invalidateConfidentialTokenBalanceQueries(token: Token, queryClient: QueryClient) {
  const tokenBalanceQueryKey = constructCofheReadContractQueryForInvalidation({
    cofheChainId: token.chainId,
    address: token.address,
    functionName: getTokenContractConfig(token.extensions.fhenix.confidentialityType).functionName,
  });

  console.log('Invalidating shield/send read contract queries for token:', token);

  queryClient.invalidateQueries({
    queryKey: tokenBalanceQueryKey,
    // TODO: it can potentially invalidate irrelevenat queries who happen to belong to the same contract but different function. Not sure if worth fixing
    exact: false,
  });
}

function invalidatePublicTokenBalanceQueries(
  {
    tokenAddress,
    chainId,
    accountAddress,
  }: {
    tokenAddress: Address;
    chainId: number;
    accountAddress: Address;
  },
  queryClient: QueryClient
) {
  const tokenBalanceQueryKey = constructPublicTokenBalanceQueryKeyForInvalidation({
    chainId,
    tokenAddress,
    accountAddress,
  });

  console.log('Invalidating public token balance read contract queries for token:', {
    chainId,
    tokenAddress,
    accountAddress,
  });

  queryClient.invalidateQueries({
    queryKey: tokenBalanceQueryKey,
    exact: true,
  });
}

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
      invalidateConfidentialTokenBalanceQueries(tx.token, queryClient);
    }

    if (tx.actionType === TransactionActionType.Shield) {
      invalidateConfidentialTokenBalanceQueries(tx.token, queryClient);

      const publicPairTokenAddress = tx.token.extensions.fhenix.erc20Pair?.address;
      assert(publicPairTokenAddress, 'Public pair token address is required for shield transaction invalidation');
      invalidatePublicTokenBalanceQueries(
        {
          tokenAddress: publicPairTokenAddress,
          chainId: tx.chainId,
          accountAddress: tx.account,
        },
        queryClient
      );
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
