import { describe, expect, it } from 'vitest';
import {
  constructCofheReadContractQueryKey,
  constructCofheReadContractQueryForInvalidation,
} from './useCofheReadContract';
import { useInvalidationContextStore } from '@/stores/invalidationContextStore';

// useCofheReadContracts runs each entry as its own query under the exact
// useCofheReadContract query key. These tests pin the invariants that design
// relies on: a write's `invalidates` descriptor resolves to a key prefix of
// every matching entry, and the invalidation-context store delivers the mined
// block hash to such an entry. If either breaks, batch entries silently stop
// refreshing on writes.

const CHAIN_ID = 421614;
const ADDRESS = '0x188aB8B383A50c0dB2fBA85F87e488Db4bEeeA2E' as const;

function entryQueryKey(functionName: string, args: readonly unknown[]) {
  return constructCofheReadContractQueryKey({
    cofheChainId: CHAIN_ID,
    address: ADDRESS,
    functionName,
    args,
    requiresACP: false,
    enabled: true,
  });
}

describe('useCofheReadContracts invalidation compatibility', () => {
  it('a descriptor prefix matches the per-entry query key', () => {
    const prefix = constructCofheReadContractQueryForInvalidation({
      cofheChainId: CHAIN_ID,
      address: ADDRESS,
      functionName: 'getTokenConfig',
    });
    const fullKey = entryQueryKey('getTokenConfig', [ADDRESS]);

    expect(fullKey.slice(0, prefix.length)).toEqual(prefix);
  });

  it('an address-only descriptor (trimmed functionName) still prefixes the entry key', () => {
    const prefix = constructCofheReadContractQueryForInvalidation({
      cofheChainId: CHAIN_ID,
      address: ADDRESS,
      functionName: undefined,
    }).filter((segment) => segment !== undefined);
    const fullKey = entryQueryKey('getOrder', [1n]);

    expect(fullKey.slice(0, prefix.length)).toEqual(prefix);
  });

  it('the invalidation-context store delivers a context stored under the descriptor key to an entry', () => {
    const store = useInvalidationContextStore.getState();
    const descriptorKey = constructCofheReadContractQueryForInvalidation({
      cofheChainId: CHAIN_ID,
      address: ADDRESS,
      functionName: 'getTokenConfig',
    });

    store.set({ queryKey: descriptorKey, context: { blockHashToBeAwareOf: '0xabc' } });

    const match = useInvalidationContextStore.getState().findMatching(entryQueryKey('getTokenConfig', [ADDRESS]));
    expect(match?.context).toEqual({ blockHashToBeAwareOf: '0xabc' });

    const noMatch = useInvalidationContextStore.getState().findMatching(entryQueryKey('getOrder', [1n]));
    expect(noMatch).toBeUndefined();

    if (match) useInvalidationContextStore.getState().remove(match.key);
  });
});
