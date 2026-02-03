import { useScheduledInvalidationsStore } from '@/stores/scheduledInvalidationsStore';
import { useMemo } from 'react';

export function useAwaitingDecryptionQueryKeySet(): ReadonlySet<string> {
  const { byKey } = useScheduledInvalidationsStore();

  const cacheKeysAwaitingDecryption = useMemo(() => Object.values(byKey).flatMap((item) => item.queryKeys), [byKey]);

  return useMemo(
    () => new Set(cacheKeysAwaitingDecryption.map((key) => JSON.stringify(key))),
    [cacheKeysAwaitingDecryption]
  );
}

export function useIsWaitingForDecryptionToInvalidate(queryKey: unknown[]): boolean {
  const cacheKeySet = useAwaitingDecryptionQueryKeySet();

  const result = useMemo(() => cacheKeySet.has(JSON.stringify(queryKey)), [cacheKeySet, queryKey]);

  console.log(`isWaitingForDecryption for queryKey ${JSON.stringify(queryKey)}:`, result);

  return result;
}
