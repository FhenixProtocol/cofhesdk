import { useMemo } from 'react';

export type NormalizeOptions<T, U extends T = T> = {
  /** Optional filter; can be a type guard to narrow the output type */
  filter?: (item: T) => item is U;
  /** Optional de-dupe key function */
  dedupeKey?: (item: U) => string;
  /** Optional deterministic sort */
  sort?: (a: U, b: U) => number;
};

export function useNormalizedList<T, U extends T = T>(items: T[] | undefined, options?: NormalizeOptions<T, U>): U[] {
  return useMemo(() => {
    if (!items || items.length === 0) return [];

    const filter = options?.filter;
    const dedupeKey = options?.dedupeKey;
    const sort = options?.sort;

    const filtered = (filter ? items.filter(filter) : (items as unknown as U[])) as U[];

    const deduped = (() => {
      if (!dedupeKey) return filtered;
      const seen = new Set<string>();
      const unique: U[] = [];
      for (const item of filtered) {
        const key = dedupeKey(item);
        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(item);
      }
      return unique;
    })();

    if (sort) deduped.sort(sort);

    return deduped;
  }, [items, options?.dedupeKey, options?.filter, options?.sort]);
}

// Compatibility aliases (internal/private helper; keep naming flexible)
export const useNormalizedItems = useNormalizedList;
export const useNormalizedTokens = useNormalizedList;
