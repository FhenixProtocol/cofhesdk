import { useMemo } from 'react';
import type { UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import type { TransactionReceipt } from 'viem';
import { assert } from 'ts-essentials';

import { useInternalQueries } from '@/providers';
import { useCofheChainId, useCofhePublicClient } from './useCofheConnection';

type TxReceiptQueryKey = readonly ['tx-receipt', number | undefined, `0x${string}`];

export type UseTransactionReceiptsByHashInput = {
  hashes?: Array<`0x${string}` | string | undefined | null>;
  /** Defaults to the connected chain id. */
  chainId?: number;
  enabled?: boolean;
  /** Additional TanStack query options applied to each receipt query. */
  queryOptions?: Omit<
    UseQueryOptions<TransactionReceipt, Error, TransactionReceipt, TxReceiptQueryKey>,
    'queryKey' | 'queryFn' | 'enabled'
  >;
};

export type UseTransactionReceiptsByHashResult = {
  results: UseQueryResult<TransactionReceipt, Error>[];
  resultsByHash: Record<`0x${string}`, UseQueryResult<TransactionReceipt, Error>>;
  receiptsByHash: Record<`0x${string}`, TransactionReceipt | undefined>;
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
  const publicClient = useCofhePublicClient();
  const cofheChainId = useCofheChainId();
  const chainId = chainIdInput ?? cofheChainId;

  const normalizedHashes = useMemo(() => {
    const seen = new Set<`0x${string}`>();
    const out: `0x${string}`[] = [];
    for (const h of hashes ?? []) {
      if (!h) continue;
      const key = h.toLowerCase() as `0x${string}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(h as `0x${string}`);
    }
    return out;
  }, [hashes]);

  const enabled = !!publicClient && !!chainId && enabledInput && normalizedHashes.length > 0;

  const queries = useMemo(() => {
    return normalizedHashes.map((hash) => {
      const queryKey: TxReceiptQueryKey = ['tx-receipt', chainId, hash];

      return {
        queryKey,
        enabled,
        queryFn: async (): Promise<TransactionReceipt> => {
          assert(publicClient, 'Public client is guaranteed by enabled condition');
          // The caller guarantees these txs are already mined.
          return await publicClient.getTransactionReceipt({ hash });
        },
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        refetchOnReconnect: false,
        ...queryOptions,
      } satisfies UseQueryOptions<TransactionReceipt, Error, TransactionReceipt, TxReceiptQueryKey>;
    });
  }, [chainId, enabled, normalizedHashes, publicClient, queryOptions]);

  const results = useInternalQueries({
    queries,
  }) as UseQueryResult<TransactionReceipt, Error>[];

  const resultsByHash = useMemo(() => {
    return normalizedHashes.reduce<Record<`0x${string}`, UseQueryResult<TransactionReceipt, Error>>>((acc, hash, i) => {
      const r = results[i];
      if (r) acc[hash] = r;
      return acc;
    }, {});
  }, [normalizedHashes, results]);

  const receiptsByHash = useMemo(() => {
    return normalizedHashes.reduce<Record<`0x${string}`, TransactionReceipt | undefined>>((acc, hash, i) => {
      acc[hash] = results[i]?.data;
      return acc;
    }, {});
  }, [normalizedHashes, results]);

  return { results, resultsByHash, receiptsByHash };
}
