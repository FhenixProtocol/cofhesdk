import {
  TransactionActionType,
  TransactionStatus,
  useTransactionStore,
  type Transaction,
} from '@/stores/transactionStore';
import { useCofhePublicClient } from './useCofheConnection';
import { useInternalQueries, useInternalQueryClient } from '@/providers';
import { assert } from 'ts-essentials';
import { constructCofheReadContractQueryForInvalidation } from './useCofheReadContract';
import { QueryClient, type QueriesOptions } from '@tanstack/react-query';
import type { Address, TransactionReceipt } from 'viem';
import { getTokenContractConfig } from '@/constants/confidentialTokenABIs';
import type { Token } from './useCofheTokenLists';
import { constructPublicTokenBalanceQueryKeyForInvalidation } from './useCofheTokenPublicBalance';
import { constructUnshieldClaimsQueryKeyForInvalidation, invalidateClaimableQueries } from './useCofheTokenClaimable';
import { usePendingTransactions } from './usePendingTransactions';
import { useScheduledInvalidationsStore } from '@/stores/scheduledInvalidationsStore';

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

  console.log('Invalidating public token balance read contract queries for token:', tokenBalanceQueryKey);

  queryClient.invalidateQueries({
    queryKey: tokenBalanceQueryKey,
  });
}

function invalidatePublicAndConfidentialTokenBalanceQueries(
  token: Token,
  accountAddress: Address,
  queryClient: QueryClient
) {
  invalidateConfidentialTokenBalanceQueries(token, queryClient);

  const publicPairTokenAddress = token.extensions.fhenix.erc20Pair?.address;
  assert(publicPairTokenAddress, 'Public pair token address is required for shield transaction invalidation');
  invalidatePublicTokenBalanceQueries(
    {
      tokenAddress: publicPairTokenAddress,
      chainId: token.chainId,
      accountAddress,
    },
    queryClient
  );
}

export function useTrackPendingTransactions() {
  // Batch check pending transactions using react-query's useQueries
  const accountsPendingTxs = usePendingTransactions();
  const publicClient = useCofhePublicClient();
  const queryClient = useInternalQueryClient();

  const { upsert: upsertScheduledInvalidation, byKey } = useScheduledInvalidationsStore();
  console.log('Scheduled invalidations store:', byKey);

  const handleInvalidations = (tx: Transaction) => {
    // TODO: add invalidation for the rest of txs
    // TODO invalidate gas on all txs since any tx spends gas
    if (tx.actionType === TransactionActionType.ShieldSend) {
      invalidateConfidentialTokenBalanceQueries(tx.token, queryClient);
    } else if (tx.actionType === TransactionActionType.Shield) {
      // on shield public balance decreases and private increases
      invalidatePublicAndConfidentialTokenBalanceQueries(tx.token, tx.account, queryClient);
    } else if (tx.actionType === TransactionActionType.Unshield) {
      // on unshield - private balance decreases, claimable increases, public remains the same
      invalidateConfidentialTokenBalanceQueries(tx.token, queryClient);

      // schedule invalidation for unshield claims once decryption is observed
      upsertScheduledInvalidation({
        key: `unshield-tx-${tx.hash}`,
        accountAddress: tx.account,
        createdAt: Date.now(),
        chainId: tx.chainId,
        triggerTxHash: tx.hash,
        queryKeys: [
          constructUnshieldClaimsQueryKeyForInvalidation({
            chainId: tx.token.chainId,
            tokenAddress: tx.token.address,
            confidentialityType: tx.token.extensions.fhenix.confidentialityType,
            accountAddress: tx.account,
          }),
        ],
      });
    } else if (tx.actionType === TransactionActionType.Claim) {
      // on claim - claimable decreases, public increases, private remains the same
      const publicTokenAddress = tx.token.extensions.fhenix.erc20Pair?.address;
      assert(publicTokenAddress, 'Public pair token address is required for claim transaction invalidation');
      invalidatePublicTokenBalanceQueries(
        {
          tokenAddress: publicTokenAddress,
          chainId: tx.token.chainId,
          accountAddress: tx.account,
        },
        queryClient
      );
      invalidateClaimableQueries({
        token: tx.token,
        accountAddress: tx.account,

        queryClient,
      });
    } else {
      // @ts-expect-error actionType = "never" at this point
      console.warn('No invalidation logic for transaction action type:', tx.actionType);
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
