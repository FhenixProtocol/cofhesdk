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
import { ETH_ADDRESS_LOWERCASE, type Token } from './useCofheTokenLists';
import {
  constructPublicTokenBalanceQueryKeyForInvalidation,
  getPublicTokenBalanceSource,
} from './useCofheTokenPublicBalance';
import { constructUnshieldClaimsQueryKeyForInvalidation, invalidateClaimableQueries } from './useCofheTokenClaimable';
import { constructTokenAllowanceQueryKeyForInvalidation } from './useTokenAllowance';
import { usePendingTransactions } from './usePendingTransactions';
import { useDecryptionWatchersStore } from '@/stores/decryptionWatchingStore';
import { useTransactionGlobalLifecycle } from './useTransactionGlobalLifecycle';
import { useEffect, useRef } from 'react';
import { cofheLogger } from '@/utils/debug';
import { isTokenOperationSupported } from '@/types/token';
import { invalidateQueriesWithContext } from '@/utils/invalidationContext';

const ZERO_BLOCK_HASH = '0x0000000000000000000000000000000000000000000000000000000000000000' as const;
const RECEIPT_BLOCK_HASH_POLLING_INTERVAL_MS = 1_000;

function hasInvalidBlockHash(blockHash: TransactionReceipt['blockHash'] | undefined) {
  return blockHash === ZERO_BLOCK_HASH;
}

function abortError(message = 'Aborted') {
  const err = new Error(message);
  err.name = 'AbortError';
  return err;
}

async function sleep(ms: number, signal?: AbortSignal) {
  if (ms <= 0) return;
  if (signal?.aborted) throw abortError();

  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      if (signal) signal.removeEventListener('abort', onAbort);
    };

    const onAbort = () => {
      clearTimeout(timeout);
      cleanup();
      reject(abortError());
    };

    const timeout = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);

    if (signal) signal.addEventListener('abort', onAbort, { once: true });
  });
}

// Some RPCs can return a mined receipt whose blockHash is still the zero sentinel.
// We normalize that here, before writing the receipt into the transaction store,
// so downstream invalidation and lifecycle code can rely on a real block hash.
async function resolveReceiptBlockHash(
  receipt: TransactionReceipt,
  publicClient: NonNullable<ReturnType<typeof useCofhePublicClient>>,
  signal?: AbortSignal
) {
  if (!hasInvalidBlockHash(receipt.blockHash)) return receipt;
  if (receipt.blockNumber === null) return receipt;

  cofheLogger.warn('Mined receipt returned invalid zero blockHash; retrying until a real block hash is available', {
    txHash: receipt.transactionHash,
    blockNumber: receipt.blockNumber,
  });

  let attempt = 0;
  while (true) {
    if (signal?.aborted) throw abortError();
    attempt += 1;

    try {
      const block = await publicClient.getBlock({
        blockNumber: receipt.blockNumber,
      });

      if (block.hash && !hasInvalidBlockHash(block.hash)) {
        cofheLogger.log('Resolved real blockHash for mined receipt after retry', {
          txHash: receipt.transactionHash,
          blockNumber: receipt.blockNumber,
          attempts: attempt,
          blockHash: block.hash,
        });

        return {
          ...receipt,
          blockHash: block.hash,
        };
      }

      cofheLogger.debug('Receipt blockHash still unavailable; retrying block lookup', {
        txHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        attempts: attempt,
        blockHash: block.hash,
      });
    } catch (error) {
      cofheLogger.warn('Failed to normalize mined receipt blockHash from blockNumber; retrying', {
        txHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        attempts: attempt,
        error,
      });
    }

    await sleep(RECEIPT_BLOCK_HASH_POLLING_INTERVAL_MS, signal);
  }
}

function invalidateConfidentialTokenBalanceQueries(
  token: Token,
  queryClient: QueryClient,
  blockHashToBeAwareOf?: `0x${string}`
) {
  const tokenBalanceQueryKey = constructCofheReadContractQueryForInvalidation({
    cofheChainId: token.chainId,
    address: token.address,
    functionName: getTokenContractConfig(token.extensions.fhenix.confidentialityType).functionName,
  });

  cofheLogger.log('Invalidating shield/send read contract queries for token:', { token, tokenBalanceQueryKey });

  const filters = {
    queryKey: tokenBalanceQueryKey,
    // TODO: it can potentially invalidate irrelevenat queries who happen to belong to the same contract but different function. Not sure if worth fixing
    exact: false,
  } as const;

  if (!blockHashToBeAwareOf) {
    queryClient.invalidateQueries(filters);
    return;
  }

  invalidateQueriesWithContext(queryClient, filters, { blockHashToBeAwareOf });
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

  cofheLogger.log('Invalidating public token balance read contract queries for token:', tokenBalanceQueryKey);

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

  const publicBalanceSource = getPublicTokenBalanceSource(token);
  assert(publicBalanceSource, 'Public balance source is required for shield transaction invalidation');
  invalidatePublicTokenBalanceQueries(
    {
      tokenAddress: publicBalanceSource.address,
      chainId: token.chainId,
      accountAddress,
    },
    queryClient
  );
}

function invalidateTokenAllowanceQueries(
  {
    chainId,
    tokenAddress,
    ownerAddress,
    spenderAddress,
  }: {
    chainId: number;
    tokenAddress: Address;
    ownerAddress: Address;
    spenderAddress: Address;
  },
  queryClient: QueryClient
) {
  const queryKey = constructTokenAllowanceQueryKeyForInvalidation({
    chainId,
    tokenAddress,
    ownerAddress,
    spenderAddress,
  });

  queryClient.invalidateQueries({ queryKey });
}

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
      try {
        const receipt = await publicClient.waitForTransactionReceipt({
          hash: tx.hash as `0x${string}`,
        });

        const normalizedReceipt = await resolveReceiptBlockHash(receipt, publicClient, signal);

        const status = normalizedReceipt.status === 'success' ? TransactionStatus.Confirmed : TransactionStatus.Failed;

        useTransactionStore.getState().updateTransactionStatus(tx.chainId, tx.hash, status, {
          receipt: normalizedReceipt,
        });

        // invalidate if tx was successful
        if (status === TransactionStatus.Confirmed) onReceiptSuccess(tx, normalizedReceipt);
        else onReceiptFail?.(tx, normalizedReceipt);

        return normalizedReceipt;
      } catch (e) {
        onFetchFailure?.(e, tx);
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

function useHandleInvalidations() {
  const queryClient = useInternalQueryClient();

  const { upsert: upsertDecryptionWatcher, byKey } = useDecryptionWatchersStore();
  cofheLogger.log('Scheduled invalidations store:', byKey);
  const handleInvalidations = (tx: Transaction, receipt?: TransactionReceipt) => {
    const blockHashToBeAwareOf = receipt?.blockHash ?? tx.receipt?.blockHash;
    // each transaction requires gas, so native token balance changes on every transaction
    invalidatePublicTokenBalanceQueries(
      {
        tokenAddress: ETH_ADDRESS_LOWERCASE,
        chainId: tx.chainId,
        accountAddress: tx.account,
      },
      queryClient
    );
    if (tx.actionType === TransactionActionType.ShieldSend) {
      invalidateConfidentialTokenBalanceQueries(tx.token, queryClient);
    } else if (tx.actionType === TransactionActionType.Shield) {
      // on shield public balance decreases and private increases
      invalidatePublicAndConfidentialTokenBalanceQueries(tx.token, tx.account, queryClient);
    } else if (tx.actionType === TransactionActionType.Unshield) {
      // on unshield - private balance decreases, claimable increases, public remains the same
      invalidateConfidentialTokenBalanceQueries(tx.token, queryClient, blockHashToBeAwareOf);

      if (tx.token.extensions.fhenix.confidentialityType === 'dual') {
        invalidateClaimableQueries({
          token: tx.token,
          accountAddress: tx.account,
          queryClient,
          blockHashToBeAwareOf,
        });
      } else if (isTokenOperationSupported(tx.token.extensions.fhenix.confidentialityType, 'claimable')) {
        // schedule invalidation for unshield claims once decryption is observed
        upsertDecryptionWatcher({
          key: `${tx.actionType}-tx-${tx.hash}`,
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
          queryClient
        );
      }
      invalidateClaimableQueries({
        token: tx.token,
        accountAddress: tx.account,

        queryClient,
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
          queryClient
        );
      }
    } else {
      // @ts-expect-error actionType = "never" at this point
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

    // 2.c. fetch failure
    onFetchFailure: (error, tx) => {
      onWatchReceiptFailure(error, tx);
    },
  });
}
