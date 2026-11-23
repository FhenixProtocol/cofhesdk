import { useMemo } from 'react';
import type { UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import type { TransactionReceipt } from 'viem';
import { assert } from 'ts-essentials';

import { useInternalQueries } from '@/providers';
import { cofheLogger } from '@/utils/debug';
import { useCofheReadTarget } from './useCofheReadContract';

type TxReceiptQueryKey = readonly ['tx-receipt', number | undefined, `0x${string}`];

export type UseTransactionReceiptsByHashInput = {
  hashes?: Set<`0x${string}`>;
  /** Defaults to the connected chain id. Queries stay disabled while an explicit id differs from it. */
  chainId?: number;
  enabled?: boolean;
  /** Additional TanStack query options applied to each receipt query. */
  queryOptions?: Omit<
    UseQueryOptions<TransactionReceipt, Error, TransactionReceipt, TxReceiptQueryKey>,
    'queryKey' | 'queryFn' | 'enabled'
  >;
};

export type UseTransactionReceiptsByHashResult = {
  queriesResults: UseQueryResult<TransactionReceipt, Error>[];
  receiptsByHash: Record<`0x${string}`, TransactionReceipt>;
};

/**
 * Fetch receipts for a list of already-mined transaction hashes.
 * Uses the internal TanStack QueryClient via `useInternalQueries`.
 */
export function useTransactionReceiptsByHash(
  { hashes, chainId: chainIdInput, enabled: enabledInput = true, queryOptions }: UseTransactionReceiptsByHashInput = {
    enabled: true,
  }
): UseTransactionReceiptsByHashResult {
  const {
    publicClient,
    cofheChainId: chainId,
    disabledDueToWrongChain,
  } = useCofheReadTarget({
    chainId: chainIdInput,
  });

  const enabled =
    !disabledDueToWrongChain && !!publicClient && !!chainId && enabledInput && hashes !== undefined && hashes.size > 0;

  const queries = useMemo(() => {
    if (!hashes) return [];
    return Array.from(hashes).map((hash) => {
      const queryKey: TxReceiptQueryKey = ['tx-receipt', chainId, hash];

      return {
        queryKey,
        enabled,
        queryFn: async (): Promise<TransactionReceipt> => {
          assert(publicClient, 'Public client is guaranteed by enabled condition');
          // The caller guarantees these txs are already mined.
          return await publicClient.getTransactionReceipt({ hash });
        },
        notifyOnChangeProps: ['data'],
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        refetchOnReconnect: false,
        ...queryOptions,
      } satisfies UseQueryOptions<TransactionReceipt, Error, TransactionReceipt, TxReceiptQueryKey>;
    });
  }, [chainId, enabled, hashes, publicClient, queryOptions]);

  const queriesResults: UseQueryResult<TransactionReceipt, Error>[] = useInternalQueries({
    queries,
  });

  const receiptsByHash = useMemo<Record<`0x${string}`, TransactionReceipt>>(() => {
    cofheLogger.log('useTransactionReceiptsByHash - receiptsByHash recalculated');
    if (!hashes) return {};
    return Array.from(hashes).reduce<Record<`0x${string}`, TransactionReceipt>>((acc, hash, i) => {
      // skip those that don't have receipt data yet
      if (!queriesResults[i]?.data) return acc;

      acc[hash] = queriesResults[i].data;
      return acc;
    }, {});
  }, [hashes, queriesResults]);

  return { queriesResults, receiptsByHash };
}
