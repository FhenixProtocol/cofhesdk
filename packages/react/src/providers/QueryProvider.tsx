import { QueryClient } from '@tanstack/react-query';
import { createContext, useContext, useMemo } from 'react';

// Internal context to expose the QueryClient used by this module
const InternalQueryClientContext = createContext<QueryClient | null>(null);

export const useInternalQueryClient = (): QueryClient => {
  const qc = useContext(InternalQueryClientContext);
  if (!qc) throw new Error('QueryClient not available. Wrap with CofheProvider/QueryProvider.');
  return qc;
};

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
    return new QueryClient();
  }, [overridingQueryClient]);
  return <InternalQueryClientContext.Provider value={queryClient}>{children}</InternalQueryClientContext.Provider>;
};
