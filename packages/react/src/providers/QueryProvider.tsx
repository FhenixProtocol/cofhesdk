import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMemo } from 'react';

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
          retry(failureCount, error) {
            console.error('Query error on retry. Retry attempt # ' + failureCount, error);
            // default query behavior - 3 retries
            return failureCount < 3;
          },
        },
      },
    });
  }, [overridingQueryClient]);
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};
