import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
//  * @deprecated use `createAsyncStoragePersister` from `@tanstack/query-async-storage-persister` instead.
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { createContext, useContext, useMemo } from 'react';
import { shouldPassToErrorBoundary } from './errors';

function isNonRetryableError(error: unknown): boolean {
  // NB: be granular here. F.x. no need to retry "bad permit error"
  // for now, disable retries on all errors that are whitelisted as handled by the err boundary
  return shouldPassToErrorBoundary(error);
}

// Internal context to expose the QueryClient used by this module
const InternalQueryClientContext = createContext<QueryClient | null>(null);

export const useInternalQueryClient = (): QueryClient => {
  const qc = useContext(InternalQueryClientContext);
  if (!qc) throw new Error('QueryClient not available. Wrap with CofheProvider/QueryProvider.');
  return qc;
};
const persistenceConfig = {
  storage: 'sessionStorage' as 'sessionStorage' | 'localStorage',
  key: 'cofhe:react-query',
  maxAgeMs: 86_400_000,
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

  const persister = useMemo(() => {
    if (typeof window === 'undefined') return undefined;
    const storage = persistenceConfig.storage === 'localStorage' ? window.localStorage : window.sessionStorage;

    return createAsyncStoragePersister({
      storage,
      key: persistenceConfig.key ?? 'cofhe:react-query',
    });
  }, []);

  const content = (
    <InternalQueryClientContext.Provider value={queryClient}>{children}</InternalQueryClientContext.Provider>
  );

  if (!persister) return content;

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: persistenceConfig.maxAgeMs ?? 86_400_000,
        buster: 'cofhe-react-query-v1',
        dehydrateOptions: {
          // Persist only decrypted ciphertext results by default.
          shouldDehydrateQuery: (query) => {
            return query.queryKey?.[0] === 'decryptCiphertext';
          },
        },
      }}
    >
      {content}
    </PersistQueryClientProvider>
  );
};
