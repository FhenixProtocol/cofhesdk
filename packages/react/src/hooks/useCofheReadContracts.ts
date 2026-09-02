import { type UseQueryOptions } from '@tanstack/react-query';
import type { Address } from 'viem';
import { useCofheChainId, useCofhePublicClient } from './useCofheConnection';
import { useCofheActiveACP } from './useCofheACPs';
import { useInternalQueries } from '../providers/index';
import { type Abi } from '@cofhe/abi';
import {
  createCofheReadContractQueryOptions,
  getEnabledForCofheReadContract,
  type UseCofheReadContractQueryOptions,
} from './useCofheReadContract';

export type CofheReadContractsContract = {
  address: Address;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
};

export type CofheReadContractsItem = {
  result?: unknown;
  error?: Error;
};

export type UseCofheReadContractsQueryOptions = Omit<
  UseQueryOptions<unknown, Error>,
  'queryKey' | 'queryFn' | 'select'
> & {
  enabled?: boolean;
};

export type UseCofheReadContractsResult = {
  /**
   * One item per contract entry, in input order. An index is `undefined` while that read has not
   * resolved yet — entries settle independently, so a partially-resolved array is normal. The whole
   * array is `undefined` when the hook is disabled or `contracts` is empty.
   */
  data: (CofheReadContractsItem | undefined)[] | undefined;
  /** True while any entry is doing its initial load. */
  isLoading: boolean;
  /** True while any entry is fetching (initial load or refetch). */
  isFetching: boolean;
  /** True once every entry has resolved successfully. */
  isSuccess: boolean;
  /** True when any entry failed — regardless of `allowFailure`, which only shapes `error`. */
  isError: boolean;
  /**
   * `null` unless `allowFailure` is `false` and at least one entry failed — then the first failure,
   * mirroring viem's multicall throw-on-failure semantics. With `allowFailure: true` (the default)
   * failures stay per-item in `data[i].error`.
   */
  error: Error | null;
  /** Refetches every entry. */
  refetch: () => Promise<void>;
  /** True when `requiresACP` is set and there is no valid active ACP (all reads are gated off). */
  disabledDueToMissingValidACP: boolean;
};

/**
 * Plural companion of `useCofheReadContract`: a DYNAMIC-length list of reads in one hook call —
 * the shape a fixed set of per-value hooks cannot express (one read per token-list entry, one per
 * order id, …).
 *
 * Each entry runs as its own query with the exact `useCofheReadContract` query key, so everything
 * built on those keys applies per entry with no extra wiring:
 * - a `useCofheWriteContract({ invalidates: [{ address, functionName }] })` target refreshes the
 *   matching entries here just like the singular reads;
 * - the refetch an invalidation triggers is block-aware — it waits until the serving RPC node
 *   knows the mined block before trusting its state;
 * - cache entries are shared with any `useCofheReadContract` of the same read.
 *
 * With a batching transport the entries still coalesce into a single JSON-RPC request; unlike the
 * previous multicall implementation this needs no multicall3 deployment on the chain.
 */
export function useCofheReadContracts(
  params: {
    contracts?: readonly CofheReadContractsContract[];
    /**
     * Kept for API compatibility with the multicall-based implementation; only `allowFailure` is
     * honored (see `UseCofheReadContractsResult.error`). Other multicall options are obsolete —
     * the reads are individual calls now.
     */
    multicallOptions?: { allowFailure?: boolean; [key: string]: unknown };
    /** Gate every read on a valid active ACP, like `useCofheReadContract`. Defaults to `false`. */
    requiresACP?: boolean;
  },
  queryOptions?: UseCofheReadContractsQueryOptions
): UseCofheReadContractsResult {
  const { contracts, multicallOptions, requiresACP = false } = params;
  const allowFailure = multicallOptions?.allowFailure ?? true;

  const publicClient = useCofhePublicClient();
  const cofheChainId = useCofheChainId();
  const activeACP = useCofheActiveACP();

  const results = useInternalQueries({
    queries: (contracts ?? []).map((contract) =>
      createCofheReadContractQueryOptions({
        enabled: getEnabledForCofheReadContract({
          publicClient,
          address: contract.address,
          abi: contract.abi,
          functionName: contract.functionName,
          requiresACP,
          hasValidActiveACP: !!activeACP?.isValid,
          userEnabled: queryOptions?.enabled,
        }),
        cofheChainId,
        address: contract.address,
        abi: contract.abi,
        functionName: contract.functionName,
        // Heterogeneous entries defeat per-entry generic inference; runtime behavior (block-aware
        // read + encrypted-return transformation) is identical to the singular hook.
        args: contract.args as never,
        requiresACP,
        activeACPHash: activeACP?.acp.hash,
        publicClient,
        queryOptions: queryOptions as UseCofheReadContractQueryOptions<Abi, never>,
      })
    ),
    combine: (queryResults) => {
      const items = queryResults.map((query): CofheReadContractsItem | undefined => {
        if (query.isSuccess) return { result: query.data };
        if (query.isError) return { error: query.error };
        return undefined;
      });

      return {
        data: queryResults.length > 0 ? items : undefined,
        isLoading: queryResults.some((query) => query.isLoading),
        isFetching: queryResults.some((query) => query.isFetching),
        isSuccess: queryResults.length > 0 && queryResults.every((query) => query.isSuccess),
        isError: queryResults.some((query) => query.isError),
        error: allowFailure ? null : (queryResults.find((query) => query.isError)?.error ?? null),
        refetch: async () => {
          await Promise.all(queryResults.map((query) => query.refetch()));
        },
      };
    },
  });

  return {
    ...results,
    disabledDueToMissingValidACP: requiresACP && (!activeACP || !activeACP.isValid),
  };
}
