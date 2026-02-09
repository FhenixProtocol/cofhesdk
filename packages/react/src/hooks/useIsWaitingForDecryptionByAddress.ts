import { useMemo } from 'react';
import { isAddress, type Address } from 'viem';
import { assert } from 'ts-essentials';
import type { QueryKey } from '@tanstack/react-query';
import { useAwaitingDecryptionQueryKeySet } from './useIsWaitingForDecryptionToInvalidate.js';

export type IsWaitingForDecryptionByAddress = Record<Address, boolean>;

export type WaitingForDecryptionEntry = {
  address: Address;
  queryKey: QueryKey;
};

/**
 * Given a list of entries and the invalidation-store snapshot, computes whether each address
 * is currently awaiting decryption invalidation.
 */
export function useIsWaitingForDecryptionByAddress(
  entries: WaitingForDecryptionEntry[]
): IsWaitingForDecryptionByAddress {
  const awaitingDecryptionKeySet = useAwaitingDecryptionQueryKeySet();

  return useMemo(() => {
    const map: IsWaitingForDecryptionByAddress = {};

    for (const entry of entries) {
      assert(isAddress(entry.address), 'address is valid');
      map[entry.address] = awaitingDecryptionKeySet.has(JSON.stringify(entry.queryKey));
    }

    return map;
  }, [awaitingDecryptionKeySet, entries]);
}
