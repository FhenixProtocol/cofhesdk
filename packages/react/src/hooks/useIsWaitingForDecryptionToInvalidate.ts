import { useScheduledInvalidationsStore } from '@/stores/scheduledInvalidationsStore';
import { useMemo } from 'react';

function useCacheKeysAwaitingDecryption() {
  const { byKey } = useScheduledInvalidationsStore();

  const queryKeys = useMemo(() => {
    return Object.values(byKey).flatMap((item) => item.queryKeys);
  }, [byKey]);

  return queryKeys;
}

export function useIsWaitingForDecryptionToInvalidateMany(queryKeys: unknown[][]): boolean {
  const cacheKeysAwaitingDecryption = useCacheKeysAwaitingDecryption();

  const cacheKeySet = useMemo(() => {
    return new Set(cacheKeysAwaitingDecryption.map((key) => JSON.stringify(key)));
  }, [cacheKeysAwaitingDecryption]);

  return useMemo(() => {
    if (queryKeys.length === 0) return false;
    return queryKeys.some((key) => cacheKeySet.has(JSON.stringify(key)));
  }, [cacheKeySet, queryKeys]);
}

export function useIsWaitingForDecryptionToInvalidate(queryKey: unknown[]): boolean {
  const result = useIsWaitingForDecryptionToInvalidateMany([queryKey]);

  console.log(`isWaitingForDecryption for queryKey ${JSON.stringify(queryKey)}:`, result);

  return result;
}
