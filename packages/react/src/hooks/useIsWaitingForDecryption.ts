import { useScheduledInvalidationsStore } from '@/stores/scheduledInvalidationsStore';
import { useMemo } from 'react';

function useCacheKeysAwaitingDecryption() {
  const { byKey } = useScheduledInvalidationsStore();

  const queryKeys = useMemo(() => {
    return Object.values(byKey).flatMap((item) => item.queryKeys);
  }, [byKey]);

  return queryKeys;
}

export function useIsWaitingForDecryption(queryKey: unknown[]): boolean {
  const cacheKeysAwaitingDecryption = useCacheKeysAwaitingDecryption();

  const result = useMemo(() => {
    return cacheKeysAwaitingDecryption.some((key) => JSON.stringify(key) === JSON.stringify(queryKey));
  }, [cacheKeysAwaitingDecryption, queryKey]);

  console.log(`isWaitingForDecryption for queryKey ${JSON.stringify(queryKey)}:`, result);

  return result;
}
