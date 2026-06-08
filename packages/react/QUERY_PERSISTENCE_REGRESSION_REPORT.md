# Query Persistence Regression Report

## Summary

React Query persistence for decrypted ciphertext results stopped being active on February 18, 2026, in commit `966a6bb0` (`chore: move rq persistence to a dedicated file`).

The persistence logic was moved out of `QueryProvider.tsx` into `queryUtils.ts`, but the new hook, `usePersistentQueriesSubscription`, was never called from `QueryProvider`. That left the persistence code present in the codebase but unreachable at runtime.

## Timeline

### Working state introduced

- Commit: `9adca8fd`
- Title: `feat: persist cts results`
- Date: 2026-02-06

This commit added React Query persistence directly in `src/providers/QueryProvider.tsx`.

At that point, the provider was responsible for:

- creating a query persister
- restoring persisted queries
- subscribing the query client for persistence updates
- limiting dehydration to decrypt-related query entries

### Regression introduced

- Commit: `966a6bb0`
- Title: `chore: move rq persistence to a dedicated file`
- Date: 2026-02-18

This refactor removed the persistence effect from `src/providers/QueryProvider.tsx` and moved the implementation into `src/providers/queryUtils.ts` as `usePersistentQueriesSubscription`.

However, the refactor did not add the corresponding call site back into `QueryProvider`.

Effectively, the commit did this:

- removed active persistence wiring from `QueryProvider`
- created `usePersistentQueriesSubscription` in `queryUtils.ts`
- never invoked that hook anywhere

That is the point where persistence stopped working.

### Later follow-up did not fix it

- Commit: `96e07970`
- Title: `fix: treat non-DOM envs as SSR and introduce a temp. no-op endpoint createSsrStorage to consolidate it`
- Date: 2026-03-20

This commit only adjusted SSR-safe storage handling inside `src/providers/queryUtils.ts`.

It did not reattach `usePersistentQueriesSubscription` to `QueryProvider`, so persistence still remained inactive.

## Root Cause

The root cause was an incomplete refactor.

Before the refactor, persistence lived inline in `QueryProvider` and was executed as part of the provider lifecycle.

After the refactor:

- the persistence implementation still existed
- the provider still created and exposed a `QueryClient`
- but the persistence hook was no longer called

So the application still had:

- React Query in-memory caching
- decrypt queries marked with `meta.persist: true`
- persisted-query defaults such as `staleTime: Infinity`

But it no longer had:

- persisted query restoration on startup
- persisted query subscription updates during runtime

## Why It Could Still Look Like It Worked

The regression was easy to miss because the non-persistent parts of the caching behavior were still intact.

`useCofheDecrypt` still used React Query with a stable query key and `meta.persist: true`, and the internal query wrapper still applied persistence-oriented defaults.

That meant decrypt results could still be reused:

- within the lifetime of the same `QueryClient`
- within the same mounted provider tree
- without refetch on mount/focus/reconnect in some cases

So short-lived in-memory cache hits could make the feature appear functional, even though the actual persistence layer had stopped running.

The missing behavior showed up when the app experienced a fresh query-client lifecycle, such as:

- page reloads
- provider remounts
- app restarts
- any flow that reconstructed the `QueryClient`

In those cases, decrypt queries behaved like cold starts again and could trigger repeated `sealOutput` requests.

## Fix Applied

The current working tree restores the missing connection by calling `usePersistentQueriesSubscription` from `src/providers/QueryProvider.tsx`.

That reactivates the persistence path that was left disconnected during the February 18 refactor.

## Validation

A focused test was added to verify that `QueryProvider` now invokes the persistence hook in both cases:

- when it creates its own `QueryClient`
- when a caller passes an overriding `QueryClient`

Test file:

- `src/providers/QueryProvider.test.tsx`

## Remaining Limitation

This regression and fix apply to the React Query persistence layer in `packages/react`.

They do not add any SDK-level memoization for `decryptForView` or `sealOutput` in `packages/sdk`.

So:

- React hook consumers can benefit from persisted decrypt query caching again
- direct SDK callers can still issue repeated network requests unless a separate SDK cache is introduced
