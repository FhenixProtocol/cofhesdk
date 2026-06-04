import type { QueryKey } from '@tanstack/react-query';
import { create } from 'zustand';

export type InvalidationContextEntry = {
  key: string;
  queryKey: QueryKey;
  context: unknown;
  createdAt: number;
};

type InvalidationContextState = {
  byKey: Record<string, InvalidationContextEntry>;
  set: (params: { queryKey: QueryKey; context: unknown }) => void;
  findMatching: (queryKey: QueryKey) => InvalidationContextEntry | undefined;
  remove: (key: string) => void;
};

function stringifyQueryKey(queryKey: QueryKey) {
  return JSON.stringify(queryKey);
}

function queryKeyStartsWith(fullQueryKey: QueryKey, prefixQueryKey: QueryKey) {
  if (prefixQueryKey.length > fullQueryKey.length) return false;

  return prefixQueryKey.every((segment, index) => JSON.stringify(segment) === JSON.stringify(fullQueryKey[index]));
}

export const useInvalidationContextStore = create<InvalidationContextState>()((set, get) => ({
  byKey: {},
  set: ({ queryKey, context }) => {
    const key = stringifyQueryKey(queryKey);

    set((state) => ({
      byKey: {
        ...state.byKey,
        [key]: {
          key,
          queryKey,
          context,
          createdAt: Date.now(),
        },
      },
    }));
  },
  findMatching: (queryKey) => {
    return Object.values(get().byKey)
      .sort((left, right) => right.createdAt - left.createdAt)
      .find((entry) => queryKeyStartsWith(queryKey, entry.queryKey));
  },
  remove: (key) => {
    set((state) => {
      if (!state.byKey[key]) return state;

      const nextByKey = { ...state.byKey };
      delete nextByKey[key];
      return { byKey: nextByKey };
    });
  },
}));
