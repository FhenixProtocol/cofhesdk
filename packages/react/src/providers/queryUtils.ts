import { QueryClient, type Query, type QueryKey } from '@tanstack/react-query';
import { persistQueryClientRestore, persistQueryClientSubscribe } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { useEffect } from 'react';
import { createSsrStorage, hasDOM } from '@cofhe/sdk/web';

export function isPersistedQuery(options: { meta?: unknown; queryKey?: QueryKey }): boolean {
  const meta = options.meta as { persist?: boolean } | undefined;
  return meta?.persist === true;
}

// Persist only opt-in (meta.persist) queries, and only while they are in the success state.
// An errored query must NOT be dehydrated: persisted queries default to staleTime Infinity /
// refetchOnMount false, so a restored error never refetches — the UI is stuck with a silent,
// unreported failure that survives reloads. Excluding it here also drops the query's
// previously-persisted success snapshot the moment it errors (dehydration reflects current
// state), so the next load starts clean and refetches live.
export function shouldDehydrateQuery(query: Pick<Query, 'meta' | 'state'>): boolean {
  return isPersistedQuery(query) && query.state.status === 'success';
}
const persistenceConfig = {
  storage: 'localStorage' satisfies 'sessionStorage' | 'localStorage',
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

const storage = !hasDOM
  ? createSsrStorage()
  : persistenceConfig.storage === 'localStorage'
    ? window.localStorage
    : window.sessionStorage;

const persister = storage
  ? createAsyncStoragePersister({
      storage,
      key: persistenceConfig.key ?? 'cofhe:react-query',
      serialize: serializeWithBigInt,
      deserialize: deserializeWithBigInt,
    })
  : undefined;

export function usePersistentQueriesSubscription({
  queryClient,
  overridingQueryClient,
}: {
  queryClient: QueryClient;
  overridingQueryClient?: QueryClient;
}) {
  // IMPORTANT:
  // Do NOT use <PersistQueryClientProvider>.
  // It wraps children with TanStack's <QueryClientProvider>, which overrides any external provider
  // the consuming dapp (e.g. Wagmi) sets up. Instead, persist/restore imperatively against *our* client.
  useEffect(() => {
    // If the consumer explicitly provides a QueryClient do not attach persistence to it.
    if (overridingQueryClient) return;

    // if there's no persister, we can't persist - but we also don't want to throw an error since persistence is a nice-to-have, not a requirement
    if (!persister) return;

    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    const options = {
      queryClient: queryClient as any,
      persister,
      maxAge: persistenceConfig.maxAgeMs ?? 86_400_000,
      buster: 'cofhe-react-query-v1',
      dehydrateOptions: {
        shouldDehydrateQuery: (query: unknown) => shouldDehydrateQuery(query as Query),
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
}
