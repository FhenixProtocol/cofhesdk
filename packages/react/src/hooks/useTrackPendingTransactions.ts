import { useInternalQueries, useInternalQueryClient } from '@/providers';
import {
  TransactionActionType,
  TransactionStatus,
  useTransactionStore,
  isCustomTransactionActionType,
  type Transaction,
} from '@/stores/transactionStore';
import { isTokenOperationSupported } from '@/types/token';
import { cofheLogger } from '@/utils/debug';
import { hasInvalidBlockHash, resolveReceiptBlockHash } from '@/utils/resolveReceiptBlockHash';
import { type QueriesOptions } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { assert } from 'ts-essentials';
import type { TransactionReceipt } from 'viem';
import {
  invalidateClaimableQueries,
  invalidateConfidentialTokenBalanceQueries,
  invalidatePublicAndConfidentialTokenBalanceQueries,
  invalidatePublicTokenBalanceQueries,
  invalidateTokenAllowanceQueries,
} from './internal/transactionInvalidation';
import { useCofhePublicClient } from './useCofheConnection';
import { ETH_ADDRESS_LOWERCASE } from './useCofheTokenLists';
import { getPublicTokenBalanceSource } from './useCofheTokenPublicBalance';
import { usePendingTransactions } from './usePendingTransactions';
import { useTransactionGlobalLifecycle } from './useTransactionGlobalLifecycle';

type UseTrackPendingTransactionsInput = {
  onReceiptSuccess: (tx: Transaction, receipt: TransactionReceipt) => void;
  onReceiptFail?: (tx: Transaction, receipt: TransactionReceipt) => void;
  onFetchFailure?: (error: unknown, tx: Transaction) => void;
};
function useTrackPendingTransactionsBase({
  onReceiptSuccess,
  onReceiptFail,
  onFetchFailure,
}: UseTrackPendingTransactionsInput) {
  // Batch check pending transactions using react-query's useQueries
  const accountsPendingTxs = usePendingTransactions();
  const publicClient = useCofhePublicClient();

  const queries: QueriesOptions<TransactionReceipt[]> = accountsPendingTxs.map((tx) => ({
    queryKey: ['tx-receipt', tx.chainId, tx.hash],
    queryFn: async ({ signal }) => {
      assert(publicClient, 'Public client is guaranteed by enabled condition');
      let receipt: TransactionReceipt;
      try {
        receipt = await publicClient.waitForTransactionReceipt({
          hash: tx.hash,
        });
      } catch (e) {
        // A fetch error says nothing about the tx: it stays pending and the query retries below.
        // Only a mined receipt with a reverted status marks it failed.
        onFetchFailure?.(e, tx);
        throw e;
      }

      // The tx is mined at this point, so the receipt's own status decides the outcome.
      // Failing to get a real blockHash for it only means invalidation can't be block-gated.
      let normalizedReceipt = receipt;
      try {
        normalizedReceipt = await resolveReceiptBlockHash(receipt, publicClient, { signal });
      } catch (error) {
        // Query cancelled (e.g. unmount): keep the tx pending so it is watched again.
        if (signal?.aborted) throw error;
        cofheLogger.warn('Using mined receipt without a real blockHash', { txHash: tx.hash, error });
      }

      const status = normalizedReceipt.status === 'success' ? TransactionStatus.Confirmed : TransactionStatus.Failed;

      useTransactionStore.getState().updateTransactionStatus(tx.chainId, tx.hash, status, {
        receipt: normalizedReceipt,
      });

      // invalidate if tx was successful
      if (status === TransactionStatus.Confirmed) onReceiptSuccess(tx, normalizedReceipt);
      else onReceiptFail?.(tx, normalizedReceipt);

      return normalizedReceipt;
    },

    enabled: !!publicClient && accountsPendingTxs.length > 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    // Keep watching a pending tx through RPC errors (rate limits, a node behind the head), with
    // the delay growing to half a minute between attempts.
    retry: true,
    retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 30_000),
  }));
  useInternalQueries({
    queries,
  });
}

function useHandleInvalidations() {
  const queryClient = useInternalQueryClient();
  const handleInvalidations = (tx: Transaction, receipt?: TransactionReceipt) => {
    const receiptBlockHash = receipt?.blockHash ?? tx.receipt?.blockHash;
    // A zero blockHash never matches a real block, so invalidate without gating on it.
    const blockHashToBeAwareOf =
      receiptBlockHash && !hasInvalidBlockHash(receiptBlockHash) ? receiptBlockHash : undefined;
    // each transaction requires gas, so native token balance changes on every transaction
    invalidatePublicTokenBalanceQueries(
      {
        tokenAddress: ETH_ADDRESS_LOWERCASE,
        chainId: tx.chainId,
        accountAddress: tx.account,
      },
      queryClient,
      blockHashToBeAwareOf
    );
    if (tx.actionType === TransactionActionType.ShieldSend) {
      invalidateConfidentialTokenBalanceQueries(tx.token, queryClient, blockHashToBeAwareOf);
    } else if (tx.actionType === TransactionActionType.Shield) {
      // on shield public balance decreases and private increases
      invalidatePublicAndConfidentialTokenBalanceQueries(tx.token, tx.account, queryClient, blockHashToBeAwareOf);
    } else if (tx.actionType === TransactionActionType.Unshield) {
      // on unshield - private balance decreases, claimable increases, public remains the same
      invalidateConfidentialTokenBalanceQueries(tx.token, queryClient, blockHashToBeAwareOf);

      if (isTokenOperationSupported(tx.token.extensions.fhenix.confidentialityType, 'claimable')) {
        invalidateClaimableQueries({
          token: tx.token,
          accountAddress: tx.account,
          queryClient,
          blockHashToBeAwareOf,
        });
      }
    } else if (tx.actionType === TransactionActionType.Claim) {
      // on claim - claimable decreases, public increases, private remains the same
      const publicBalanceSource = getPublicTokenBalanceSource(tx.token);
      if (publicBalanceSource) {
        invalidatePublicTokenBalanceQueries(
          {
            tokenAddress: publicBalanceSource.address,
            chainId: tx.token.chainId,
            accountAddress: tx.account,
          },
          queryClient,
          blockHashToBeAwareOf
        );
      }
      invalidateClaimableQueries({
        token: tx.token,
        accountAddress: tx.account,

        queryClient,
        blockHashToBeAwareOf,
      });
    } else if (tx.actionType === TransactionActionType.Approve) {
      const publicBalanceSource = getPublicTokenBalanceSource(tx.token);
      if (publicBalanceSource && publicBalanceSource.address.toLowerCase() !== ETH_ADDRESS_LOWERCASE) {
        invalidateTokenAllowanceQueries(
          {
            chainId: tx.token.chainId,
            tokenAddress: publicBalanceSource.address,
            ownerAddress: tx.account,
            spenderAddress: tx.token.address,
          },
          queryClient,
          blockHashToBeAwareOf
        );
      }
    } else if (isCustomTransactionActionType(tx.actionType)) {
      // Gas balance was invalidated above; custom transactions own any app-specific cache invalidation.
    } else {
      cofheLogger.warn('No invalidation logic for transaction action type:', tx.actionType);
    }
  };

  return handleInvalidations;
}

function useOnceTransactionSubmitted(onSubmit: (tx: Transaction) => void) {
  const pendingTransactions = usePendingTransactions();
  const previousPendingTxsRef = useRef<Transaction[]>([]);

  useEffect(() => {
    const newlySubmittedTxs = pendingTransactions.filter(
      (tx) => !previousPendingTxsRef.current.some((prevTx) => prevTx.hash === tx.hash)
    );

    for (const tx of newlySubmittedTxs) {
      onSubmit(tx);

      // You can add any additional logic you want to execute once per transaction submission here
    }

    previousPendingTxsRef.current = pendingTransactions;
  }, [onSubmit, pendingTransactions]);
}

export function useTrackPendingTransactions() {
  const handleInvalidations = useHandleInvalidations();
  const { onTransactionMined, onWatchReceiptFailure, onTransactionSubmitted } = useTransactionGlobalLifecycle();
  // The fetch-failure toast fires once per tx; the query keeps retrying quietly after that.
  const reportedFetchFailures = useRef(new Set<`0x${string}`>());

  // 1 tx submitted
  useOnceTransactionSubmitted(onTransactionSubmitted);

  useTrackPendingTransactionsBase({
    // 2.a. tx mined successfully
    onReceiptSuccess: (tx, receipt) => {
      handleInvalidations(tx, receipt);
      onTransactionMined(tx, receipt);
    },
    // 2.b. tx mined with failure
    onReceiptFail: (tx, receipt) => {
      onTransactionMined(tx, receipt);
    },

    // 2.c. fetch failure: the tx is still pending and the query retries
    onFetchFailure: (error, tx) => {
      if (reportedFetchFailures.current.has(tx.hash)) return;
      reportedFetchFailures.current.add(tx.hash);
      onWatchReceiptFailure(error, tx);
    },
  });
}
