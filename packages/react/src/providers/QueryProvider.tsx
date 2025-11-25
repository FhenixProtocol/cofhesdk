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
  const queryClient = useMemo(() => overridingQueryClient ?? new QueryClient(), [overridingQueryClient]);
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};
