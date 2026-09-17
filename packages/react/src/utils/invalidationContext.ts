import {
  type InvalidateQueryFilters,
  type QueryClient,
  type QueryFunctionContext,
  type QueryKey,
} from '@tanstack/react-query';
import { useInvalidationContextStore } from '@/stores/invalidationContextStore';

/** Standard react-query invalidation filters, except `queryKey` is required — it is the key the context is stored under. */
export type InvalidationContextQueryFilters = InvalidateQueryFilters & {
  queryKey: QueryKey;
};

/** A query function that additionally receives `invalidationContext`: the context passed to
 * `invalidateQueriesWithContext`, or `undefined` when the fetch wasn't triggered by it. */
export type QueryFunctionWithInvalidationContext<
  TQueryKey extends QueryKey = QueryKey,
  TContext = unknown,
  TData = unknown,
> = (
  context: QueryFunctionContext<TQueryKey> & { invalidationContext: TContext | undefined }
) => Promise<TData> | TData;

/**
 * Invalidates queries like `queryClient.invalidateQueries(filters)`, but first stashes `context`
 * under `filters.queryKey` so the refetches this triggers can read it — provided their query
 * function is wrapped with `withInvalidationContext`.
 */
export function invalidateQueriesWithContext<TContext>(
  queryClient: QueryClient,
  filters: InvalidationContextQueryFilters,
  context: TContext
) {
  useInvalidationContextStore.getState().set({
    queryKey: filters.queryKey,
    context,
  });

  return queryClient.invalidateQueries(filters);
}

/**
 * Looks up the stored context for a query's key. An entry matches when its (invalidation) key is a
 * prefix of `queryKey`, mirroring react-query's own key matching; the most recently stored match
 * wins. Does not remove the entry — pass `match` to `consumeInvalidationContext` for that.
 */
export function findMatchingInvalidationContext<TContext>(queryKey: QueryKey) {
  const match = useInvalidationContextStore.getState().findMatching(queryKey);

  return {
    match,
    context: match?.context as TContext | undefined,
  };
}

/** Removes a matched entry from the store, so the context is delivered to at most one fetch. No-op when there was no match. */
export function consumeInvalidationContext(match: { key: string } | undefined) {
  if (!match) return;
  useInvalidationContextStore.getState().remove(match.key);
}

/**
 * Wraps a query function so it receives the `invalidationContext` stored by
 * `invalidateQueriesWithContext` (or `undefined` on ordinary fetches). The entry is consumed only
 * after the query function resolves, so a failed fetch leaves it available for the retry.
 */
export function withInvalidationContext<TQueryKey extends QueryKey, TContext, TData>(
  queryFn: QueryFunctionWithInvalidationContext<TQueryKey, TContext, TData>
) {
  return async (queryFnContext: QueryFunctionContext<TQueryKey>) => {
    const { match, context } = findMatchingInvalidationContext<TContext>(queryFnContext.queryKey);
    const result = await queryFn({
      ...queryFnContext,
      invalidationContext: context,
    });

    consumeInvalidationContext(match);
    return result;
  };
}
