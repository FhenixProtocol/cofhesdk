import {
  useQuery as rqUseQuery,
  useMutation as rqUseMutation,
  useQueries as rqUseQueries,
  type UseQueryOptions,
  type UseQueryResult,
  type UseMutationOptions,
  type UseMutationResult,
} from '@tanstack/react-query';
import { useInternalQueryClient } from './QueryProvider';

/**
 * Internal wrapper for TanStack's useQuery that always uses the module's QueryClient.
 * Drop-in replacement: use `useInternalQuery(options)`.
 */
export function useInternalQuery<TData = unknown, TError = Error, TSelectedData = TData>(
  options: UseQueryOptions<TData, TError, TSelectedData>
): UseQueryResult<TSelectedData, TError> {
  const qc = useInternalQueryClient();
  return rqUseQuery<TData, TError, TSelectedData>(options, qc);
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
 * Keep the same options object structure but without specifying `queryClient`.
 */
export function useInternalQueries<TData = unknown, TError = unknown>(options: {
  queries: Array<UseQueryOptions<TData, TError>>;
}) {
  const qc = useInternalQueryClient();
  const res = rqUseQueries(options, qc);
  return res;
}
