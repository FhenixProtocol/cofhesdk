import { type UseQueryOptions } from '@tanstack/react-query';
import type { Address, MulticallContracts, Narrow } from 'viem';
import { useCofheActiveACP } from './useCofheACPs';
import { useInternalQueries } from '../providers/index';
import { type Abi, type CofheReturnType } from '@cofhe/abi';
import {
  createCofheReadContractQueryOptions,
  getEnabledForCofheReadContract,
  useCofheReadTarget,
  type CofheReadChainParams,
  type UseCofheReadContractQueryOptions,
} from './useCofheReadContract';

export type CofheReadContractsContract = {
  address: Address;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
};

export type CofheReadContractsItem<TResult = unknown> = {
  result?: TResult;
  error?: Error;
};

/**
 * The decoded result of one `contracts` entry: what `useCofheReadContract` returns for the same
 * read, encrypted outputs included — an `euint64` output is the encrypted value `{ ctHash, utype }`,
 * not a bigint. `unknown` when the entry's `abi` / `functionName` are not literal enough to tell
 * (an `abi` typed as plain `Abi`, a `functionName` widened to `string`).
 */
export type CofheReadContractsEntryResult<contract> = contract extends {
  abi: infer abi extends Abi;
  functionName: infer functionName extends string;
}
  ? CofheReturnType<abi, functionName>
  : unknown;

/**
 * `data` for a `contracts` array: one item per entry, in input order, each typed by its own entry.
 * A literal tuple maps index by index; a homogeneous list (`tokens.map(...)`, with a literal
 * `functionName`) maps to an array of that entry's item; anything looser keeps `unknown` results.
 * The walk mirrors viem's `MulticallResults`, with the SDK's encrypted-aware return type per entry.
 */
export type CofheReadContractsData<
  contracts extends readonly unknown[],
  result extends readonly unknown[] = readonly [],
> = contracts extends readonly []
  ? result
  : contracts extends readonly [infer contract, ...infer rest]
    ? CofheReadContractsData<
        [...rest],
        readonly [...result, CofheReadContractsItem<CofheReadContractsEntryResult<contract>> | undefined]
      >
    : readonly unknown[] extends contracts
      ? (CofheReadContractsItem | undefined)[]
      : contracts extends readonly (infer contract)[]
        ? (CofheReadContractsItem<CofheReadContractsEntryResult<contract>> | undefined)[]
        : (CofheReadContractsItem | undefined)[];

export type UseCofheReadContractsQueryOptions = Omit<
  UseQueryOptions<unknown, Error>,
  'queryKey' | 'queryFn' | 'select'
> & {
  enabled?: boolean;
};

export type UseCofheReadContractsResult<TContracts extends readonly unknown[] = readonly unknown[]> = {
  /**
   * One item per contract entry, in input order, typed by its entry (see `CofheReadContractsData`).
   * An index is `undefined` while that read has not resolved yet — entries settle independently, so
   * a partially-resolved array is normal. The whole array is `undefined` when the hook is disabled or
   * `contracts` is empty.
   */
  data: CofheReadContractsData<Narrow<TContracts>> | undefined;
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
  /** True when the batch is pinned to a `chainId` the client able to serve it is not on (see `CofheReadChainParams`). */
  disabledDueToWrongChain: boolean;
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
 *
 * Typing: `contracts` is a const generic checked entry by entry against its own `abi` (viem's
 * `MulticallContracts` over `Narrow<…>`, exactly as viem's `multicall` and wagmi's `useReadContracts`
 * declare it — `Narrow` is what keeps the literals through inference), and `data[i].result` is typed
 * per entry (`CofheReadContractsData`). Entries built in a `.map` keep their types when the
 * `functionName` stays literal (`functionName: 'balanceOf' as const`); a looser shape still works
 * and falls back to `unknown` results.
 *
 * Chain and client: `chainId` / `publicClient` work exactly as on `useCofheReadContract`, for the
 * whole batch.
 */
export function useCofheReadContracts<
  const TContracts extends readonly unknown[] = readonly CofheReadContractsContract[],
>(
  params: {
    contracts?: MulticallContracts<Narrow<TContracts>, { mutability: 'pure' | 'view' }>;
    /**
     * Kept for API compatibility with the multicall-based implementation; only `allowFailure` is
     * honored (see `UseCofheReadContractsResult.error`). Other multicall options are obsolete —
     * the reads are individual calls now.
     */
    multicallOptions?: { allowFailure?: boolean; [key: string]: unknown };
    /** Gate every read on a valid active ACP, like `useCofheReadContract`. Defaults to `false`. */
    requiresACP?: boolean;
  } & CofheReadChainParams,
  queryOptions?: UseCofheReadContractsQueryOptions
): UseCofheReadContractsResult<TContracts> {
  const { contracts, multicallOptions, requiresACP = false } = params;
  const allowFailure = multicallOptions?.allowFailure ?? true;
  // The per-entry types live at the signature; the batch itself runs on the loose entry shape,
  // exactly as the singular hook's query builder does.
  const entries = (contracts ?? []) as readonly CofheReadContractsContract[];

  // The whole batch shares one chain and client — same semantics as the singular hook.
  const { publicClient, cofheChainId, disabledDueToWrongChain } = useCofheReadTarget(params);
  const activeACP = useCofheActiveACP(cofheChainId);

  const results = useInternalQueries({
    queries: entries.map((contract) =>
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
        error: allowFailure ? null : queryResults.find((query) => query.isError)?.error ?? null,
        refetch: async () => {
          await Promise.all(queryResults.map((query) => query.refetch()));
        },
      };
    },
  });

  return {
    ...results,
    // `combine` assembles the items on the loose shape; each `result` is what the singular query
    // for that entry decoded, which is exactly what `CofheReadContractsData` states per entry.
    data: results.data as CofheReadContractsData<Narrow<TContracts>> | undefined,
    disabledDueToMissingValidACP: requiresACP && (!activeACP || !activeACP.isValid),
    disabledDueToWrongChain,
  };
}
