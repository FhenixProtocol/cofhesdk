import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMemo } from 'react';
import { shouldPassToErrorBoundary } from './errors';

function isNonRetryableError(error: unknown): boolean {
  // NB: be granular here. F.x. no need to retry "bad permit error"
  // for now, disable retries on all errors that are whitelisted as handled by the err boundary
  return shouldPassToErrorBoundary(error);
}
export const QueryProvider = ({
  children,
  queryClient: overridingQueryClient,
}: {
  children: React.ReactNode;
  queryClient?: QueryClient;
}) => {
  // Create a client if not provided
  const queryClient = useMemo(() => {
    if (overridingQueryClient) return overridingQueryClient;
    return new QueryClient({
      defaultOptions: {
        queries: {
          throwOnError: (error) => shouldPassToErrorBoundary(error),
          retry: (failureCount, error) =>
            // default query behavior - 3 retries
            isNonRetryableError(error) ? false : failureCount < 3,
        },
      },
    });
  }, [overridingQueryClient]);
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};
