import {
  useQuery as rqUseQuery,
  useMutation as rqUseMutation,
  useQueries as rqUseQueries,
  type QueryKey,
  type UseQueryOptions,
  type UseQueryResult,
  type UseMutationOptions,
  type UseMutationResult,
} from '@tanstack/react-query';
import { useInternalQueryClient } from './QueryProvider';
import { isPersistedQuery } from './queryUtils';

function applyPersistedDefaults<TData, TError, TSelectedData>(
  options: UseQueryOptions<TData, TError, TSelectedData>
): UseQueryOptions<TData, TError, TSelectedData> {
  if (!isPersistedQuery(options as { meta?: unknown; queryKey?: QueryKey })) return options;

  return {
    ...options,
    // Persisted results are typically deterministic. Default to not refetching on mount/focus/reconnect.
    // Consumers can override per-query when needed.
    staleTime: options.staleTime ?? Infinity,
    refetchOnMount: options.refetchOnMount ?? false,
    refetchOnWindowFocus: options.refetchOnWindowFocus ?? false,
    refetchOnReconnect: options.refetchOnReconnect ?? false,
  };
}

/**
 * Internal wrapper for TanStack's useQuery that always uses the module's QueryClient.
 * Drop-in replacement: use `useInternalQuery(options)`.
 */
export function useInternalQuery<TData = unknown, TError = Error, TSelectedData = TData>(
  options: UseQueryOptions<TData, TError, TSelectedData>
): UseQueryResult<TSelectedData, TError> {
  const qc = useInternalQueryClient();
  return rqUseQuery<TData, TError, TSelectedData>(applyPersistedDefaults(options), qc);
}

/**
 * Internal wrapper for TanStack's useMutation that always uses the module's QueryClient.
 * Drop-in replacement: use `useInternalMutation(options)`.
 */
export function useInternalMutation<TData = unknown, TError = Error, TVariables = void, TContext = unknown>(
  options: UseMutationOptions<TData, TError, TVariables, TContext>
): UseMutationResult<TData, TError, TVariables, TContext> {
  const qc = useInternalQueryClient();
  return rqUseMutation<TData, TError, TVariables, TContext>(options, qc);
}

/**
 * Internal wrapper for TanStack's useQueries that always uses the module's QueryClient.
 * Typing mirrors `rqUseQueries` so all generics and inference are preserved.
 */
export const useInternalQueries: typeof rqUseQueries = (options, _ignoredQueryClient) => {
  const qc = useInternalQueryClient();
  if (options && typeof options === 'object' && 'queries' in options) {
    const typedOptions = options as { queries: Array<UseQueryOptions<any, any, any>> };
    return rqUseQueries(
      {
        ...(options as any),
        queries: typedOptions.queries.map((q) => applyPersistedDefaults(q)),
      } as any,
      qc
    );
  }
  return rqUseQueries(options as any, qc);
};
