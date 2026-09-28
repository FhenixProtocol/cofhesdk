import { partialMatchKey, type QueryKey } from '@tanstack/react-query';
import { create } from 'zustand';

/**
 * A block-awareness WATERMARK: every fetch whose query key falls under `queryKey`
 * must honor `context` (be aware of the mined block) until `expiresAt`. Entries
 * expire by TIME, never by delivery — so a query created AFTER the invalidation
 * (a new args variant, a two-stage ids→batch read) is gated exactly like the
 * refetches the invalidation itself triggered. Delivery-order luck is not part
 * of the design.
 */
export type InvalidationContextEntry = {
  key: string;
  queryKey: QueryKey;
  context: unknown;
  createdAt: number;
  expiresAt: number;
};

type InvalidationContextState = {
  byKey: Record<string, InvalidationContextEntry>;
  set: (params: { queryKey: QueryKey; context: unknown; ttlMs?: number }) => void;
  findMatching: (queryKey: QueryKey) => InvalidationContextEntry | undefined;
};

/** How long a watermark gates reads under its prefix. Once the serving node has
 * caught up (typically a block or two), the gate probe resolves instantly in the
 * same JSON-RPC batch as the read — so the tail of the window is near-free. */
const DEFAULT_WATERMARK_TTL_MS = 60_000;

function stringifyQueryKey(queryKey: QueryKey) {
  return JSON.stringify(queryKey);
}

function withoutExpired(byKey: Record<string, InvalidationContextEntry>, now: number) {
  const entries = Object.values(byKey).filter((entry) => entry.expiresAt > now);
  if (entries.length === Object.keys(byKey).length) return byKey;
  return Object.fromEntries(entries.map((entry) => [entry.key, entry]));
}

export const useInvalidationContextStore = create<InvalidationContextState>()((set, get) => ({
  byKey: {},
  set: ({ queryKey, context, ttlMs }) => {
    const key = stringifyQueryKey(queryKey);
    const now = Date.now();

    set((state) => ({
      // Setting is also when expired watermarks are pruned — no timers needed,
      // and an entry no query ever visits cannot accumulate forever.
      byKey: {
        ...withoutExpired(state.byKey, now),
        [key]: {
          key,
          queryKey,
          context,
          createdAt: now,
          expiresAt: now + (ttlMs ?? DEFAULT_WATERMARK_TTL_MS),
        },
      },
    }));
  },
  // A watermark covers exactly the queries its invalidation refetched: the same
  // matcher `invalidateQueries` uses, react-query's own `partialMatchKey` (the
  // entry's key is a deep subset of the query's) — e.g. an args-narrowed entry
  // `[…, [orderId]]` reaches the key `[…, [orderId, seq]]`.
  findMatching: (queryKey) => {
    const now = Date.now();
    return Object.values(get().byKey)
      .filter((entry) => entry.expiresAt > now)
      .sort((left, right) => right.createdAt - left.createdAt)
      .find((entry) => partialMatchKey(queryKey, entry.queryKey));
  },
}));
