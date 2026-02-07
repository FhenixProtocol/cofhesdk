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
  storage: 'localStorage' as 'sessionStorage' | 'localStorage',
  key: 'cofhe:react-query',
  maxAgeMs: 86_400_000,
};

const BIGINT_SENTINEL_KEY = '__cofhe_bigint__';

function serializeWithBigInt(value: any): string {
  return JSON.stringify(value, (_key, v) => {
    if (typeof v === 'bigint') return { [BIGINT_SENTINEL_KEY]: v.toString() };
    return v;
  });
}

function deserializeWithBigInt(serialized: string): any {
  return JSON.parse(serialized, (_key, v) => {
    if (
      v &&
      typeof v === 'object' &&
      BIGINT_SENTINEL_KEY in (v as Record<string, unknown>) &&
      typeof (v as Record<string, unknown>)[BIGINT_SENTINEL_KEY] === 'string'
    ) {
      return BigInt((v as Record<string, unknown>)[BIGINT_SENTINEL_KEY] as string);
    }
    return v;
  });
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

  const persister = useMemo(() => {
    if (typeof window === 'undefined') return undefined;

    const storage = persistenceConfig.storage === 'localStorage' ? window.localStorage : window.sessionStorage;
    return createAsyncStoragePersister({
      storage,
      key: persistenceConfig.key ?? 'cofhe:react-query',
      serialize: serializeWithBigInt,
      deserialize: deserializeWithBigInt,
    });
  }, []);

  const content = (
    <InternalQueryClientContext.Provider value={queryClient}>{children}</InternalQueryClientContext.Provider>
  );

  // No-op on the server / non-browser environments.
  if (!persister) return content;

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: persistenceConfig.maxAgeMs ?? 86_400_000,
        buster: 'cofhe-react-query-v1',
        dehydrateOptions: {
          // Persist only queries that opt-in via meta.persist.
          // Backwards-compat: also persist decrypt results by queryKey prefix.
          shouldDehydrateQuery: (query) => {
            if (query.meta?.persist === true) return true;
            return query.queryKey?.[0] === 'decryptCiphertext';
          },
        },
      }}
    >
      {content}
    </PersistQueryClientProvider>
  );
};
