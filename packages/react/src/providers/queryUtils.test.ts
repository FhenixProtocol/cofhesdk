import { describe, expect, it } from 'vitest';
import { shouldDehydrateQuery } from './queryUtils';

const query = (persist: boolean | undefined, status: 'success' | 'error' | 'pending') =>
  ({
    meta: persist === undefined ? undefined : { persist },
    state: { status },
  }) as Parameters<typeof shouldDehydrateQuery>[0];

describe('shouldDehydrateQuery', () => {
  it('persists opted-in successful queries', () => {
    expect(shouldDehydrateQuery(query(true, 'success'))).toBe(true);
  });

  it('never persists errored queries — a restored error cannot refetch (staleTime Infinity / refetchOnMount false) and would stick as a silent permanent failure', () => {
    expect(shouldDehydrateQuery(query(true, 'error'))).toBe(false);
  });

  it('never persists pending queries', () => {
    expect(shouldDehydrateQuery(query(true, 'pending'))).toBe(false);
  });

  it('ignores queries that did not opt in via meta.persist', () => {
    expect(shouldDehydrateQuery(query(false, 'success'))).toBe(false);
    expect(shouldDehydrateQuery(query(undefined, 'success'))).toBe(false);
  });
});
