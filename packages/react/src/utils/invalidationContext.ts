import {
  type InvalidateQueryFilters,
  type QueryClient,
  type QueryFunctionContext,
  type QueryKey,
} from '@tanstack/react-query';
import { useInvalidationContextStore } from '@/stores/invalidationContextStore';

/**
 * Standard react-query invalidation filters, except `queryKey` is required — it is the key the
 * context is stored under. `targetChainId` is the chain whose node serves the reads under that
 * key, when known: `useCofheWriteContract` gates a target (stores the mined block as its
 * watermark) only when this equals the chain the write was mined on; every other target gets a
 * plain refresh.
 */
export type InvalidationContextQueryFilters = InvalidateQueryFilters & {
  queryKey: QueryKey;
  targetChainId?: number;
};

/** A query function that additionally receives `invalidationContext`: the context passed to
 * `invalidateQueriesWithContext`, or `undefined` when no watermark covers the fetch. */
export type QueryFunctionWithInvalidationContext<
  TQueryKey extends QueryKey = QueryKey,
  TContext = unknown,
  TData = unknown,
> = (
  context: QueryFunctionContext<TQueryKey> & { invalidationContext: TContext | undefined }
) => Promise<TData> | TData;

export type InvalidateQueriesWithContextOptions = {
  /** How long the stored watermark gates fetches under the prefix (default 60s). */
  ttlMs?: number;
  /**
   * Store the watermark under this prefix instead of `filters.queryKey` — a NARROWER prefix inside
   * the invalidated set, e.g. the mined chain's slice of a key that spans every chain. The
   * invalidation itself still uses `filters`.
   */
  watermarkKey?: QueryKey;
};

/**
 * Invalidates queries like `queryClient.invalidateQueries(filters)`, but first stores `context`
 * under `filters.queryKey` as a WATERMARK: until it expires (`ttlMs`, default 60s), EVERY fetch
 * whose key falls under the prefix receives it — the refetches this call triggers, staggered
 * refetches that start later, and queries that don't even exist yet (a new args variant created
 * from the tx's outcome, the second stage of an ids→batch read). Delivery is deterministic, not
 * ordering luck; entries expire by time, never by being read. Requires the query functions to be
 * wrapped with `withInvalidationContext`.
 *
 * The context must describe a block that EXISTS on the chain serving the reads under the
 * watermark: a node asked to wait for another chain's block never sees it and stalls every fetch
 * for the whole wait window. `useCofheWriteContract` enforces this per target; callers of this
 * primitive are on their own.
 */
export function invalidateQueriesWithContext<TContext>(
  queryClient: QueryClient,
  filters: InvalidationContextQueryFilters,
  context: TContext,
  options: InvalidateQueriesWithContextOptions = {}
) {
  const { targetChainId: _targetChainId, ...queryFilters } = filters;
  useInvalidationContextStore.getState().set({
    queryKey: options.watermarkKey ?? filters.queryKey,
    context,
    ttlMs: options.ttlMs,
  });

  return queryClient.invalidateQueries(queryFilters);
}

/**
 * Looks up the active (non-expired) watermark covering a query's key. An entry matches when its
 * (invalidation) key is a prefix of `queryKey` under react-query's partial-matching semantics;
 * the most recently stored match wins.
 */
export function findMatchingInvalidationContext<TContext>(queryKey: QueryKey) {
  const match = useInvalidationContextStore.getState().findMatching(queryKey);

  return {
    match,
    context: match?.context as TContext | undefined,
  };
}

/**
 * Wraps a query function so it receives the `invalidationContext` stored by
 * `invalidateQueriesWithContext` (or `undefined` when no watermark covers the fetch). The
 * watermark is NOT consumed — it keeps gating every fetch under its prefix until it expires.
 */
export function withInvalidationContext<TQueryKey extends QueryKey, TContext, TData>(
  queryFn: QueryFunctionWithInvalidationContext<TQueryKey, TContext, TData>
) {
  return async (queryFnContext: QueryFunctionContext<TQueryKey>) => {
    const { context } = findMatchingInvalidationContext<TContext>(queryFnContext.queryKey);
    return queryFn({
      ...queryFnContext,
      invalidationContext: context,
    });
  };
}
