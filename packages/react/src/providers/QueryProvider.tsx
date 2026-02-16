import { QueryClient } from '@tanstack/react-query';
import { persistQueryClientRestore, persistQueryClientSubscribe } from '@tanstack/react-query-persist-client';
//  * @deprecated use `createAsyncStoragePersister` from `@tanstack/query-async-storage-persister` instead.
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { createContext, useContext, useEffect, useMemo } from 'react';
import { isPersistedQuery } from './queryUtils';

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

const storage = persistenceConfig.storage === 'localStorage' ? window.localStorage : window.sessionStorage;
const persister = createAsyncStoragePersister({
  storage,
  key: persistenceConfig.key ?? 'cofhe:react-query',
  serialize: serializeWithBigInt,
  deserialize: deserializeWithBigInt,
});

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

  // IMPORTANT:
  // Do NOT render <PersistQueryClientProvider> here.
  // It wraps children with TanStack's <QueryClientProvider>, which overrides any external provider
  // the consuming dapp (e.g. Wagmi) sets up. Instead, persist/restore imperatively against *our* client.
  useEffect(() => {
    // If the consumer explicitly provides a QueryClient do not attach persistence to it.
    if (overridingQueryClient) return;

    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    const options = {
      queryClient: queryClient as any,
      persister,
      maxAge: persistenceConfig.maxAgeMs ?? 86_400_000,
      buster: 'cofhe-react-query-v1',
      dehydrateOptions: {
        // Persist only queries that opt-in via meta.persist.
        // Backwards-compat: also persist decrypt results by queryKey prefix.
        shouldDehydrateQuery: (query: unknown) => isPersistedQuery(query as any),
      },
    };

    persistQueryClientRestore(options)
      .catch(() => {
        // Ignore restore errors (e.g. corrupt storage); we'll simply start fresh.
      })
      .finally(() => {
        if (cancelled) return;
        unsubscribe = persistQueryClientSubscribe(options);
      });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [overridingQueryClient, queryClient]);

  return <InternalQueryClientContext.Provider value={queryClient}>{children}</InternalQueryClientContext.Provider>;
};
