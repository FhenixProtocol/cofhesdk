# Query Invalidation Context

This note explains the block-hash-aware invalidation pattern currently used in `@cofhe/react`.

## Why This Exists

Some queries are invalidated immediately after a transaction is mined. In practice, that can refetch too early:

- the transaction receipt is already available
- React Query starts a refetch
- the RPC node serving the read is not yet aware of the block that included the transaction

When that happens, the refetch can briefly return stale pre-transaction state.

The current fix is to make specific invalidations carry a small piece of transient context:

- `blockHashToBeAwareOf`

The next refetch for the matching query receives that block hash and waits until the RPC can see that block before performing the read.

## The Moving Parts

### 1. `invalidateQueriesWithContext`

File: `src/utils/invalidationContext.ts`

This is a thin wrapper around `queryClient.invalidateQueries(...)`.

Before invalidating, it stores:

- the invalidated `queryKey`
- an arbitrary context object

Today that context is:

```ts
{
  blockHashToBeAwareOf: `0x${string}`;
}
```

So the invalidation still behaves like a normal React Query invalidation, but the next matching query function can read extra information.

### 2. `useInvalidationContextStore`

File: `src/stores/invalidationContextStore.ts`

This Zustand store keeps transient invalidation context entries.

Each entry contains:

- `queryKey`
- `context`
- `createdAt`

Matching is prefix-based, not exact.

That is intentional: many invalidations use a partial query key, and the refetched query often has a longer key with extra segments.

Current matching rules:

- the invalidation key must be a prefix of the query key
- if multiple entries match, the newest one wins
- the store key is `JSON.stringify(queryKey)`

### 3. `withInvalidationContext`

File: `src/utils/invalidationContext.ts`

This wraps a query function.

On query execution it:

1. looks up the newest matching invalidation-context entry for the query key
2. injects `invalidationContext` into the wrapped query function
3. removes the matched entry after the query function completes

That means the context is meant to be single-use and tied to the next matching refetch.

### 4. `maybeWaitUntilRpcAwareAndReadContract`

File: `src/utils/waitUntilRpcAwareAndReadContract.ts`

This is where the block-hash awareness actually matters.

If no block hash is provided, it performs a normal `readContract`.

If `blockHashToBeAwareOf` is provided, it loops until both of these are true:

- `eth_getBlockByHash(blockHash)` succeeds
- the contract read succeeds

The helper issues those requests concurrently. When the transport batches concurrent RPC calls, both requests can hit the same backend node, which reduces the chance of reading from a lagging replica.

## End-To-End Flow

The current end-to-end flow is:

1. A transaction is mined.
2. The invalidation layer extracts `receipt.blockHash`.
3. For selected caches, it calls `invalidateQueriesWithContext(...)` instead of plain `invalidateQueries(...)`.
4. React Query schedules a refetch.
5. The target query is wrapped with `withInvalidationContext(...)`.
6. The query function receives `invalidationContext?.blockHashToBeAwareOf`.
7. The query read path passes that value into `maybeWaitUntilRpcAwareAndReadContract(...)`.
8. The read waits until the RPC can see the mined block, then returns post-transaction state.

## Current Rollout

At the moment this is wired for the unshield flow.

The block-hash-aware invalidations currently cover:

- confidential token balances
- user claimable/unshield-claims queries

The relevant mined-transaction logic lives in `src/hooks/useTrackPendingTransactions.ts`.

For `TransactionActionType.Unshield`:

- confidential balance invalidation is block-hash-aware immediately
- dual-token claimable invalidation is block-hash-aware immediately
- non-dual claimable invalidation is deferred until decryption is observed, then invalidated later

## Query-Side Examples

### Generic contract reads

`useCofheReadContract` already uses:

- `withInvalidationContext(...)`
- `maybeWaitUntilRpcAwareAndReadContract(...)`

So any invalidation that targets those query keys can pass block-hash context and the read path will honor it.

### Unshield claims

`useCofheTokenClaimable` and `useCofheTokensClaimable` also use:

- `withInvalidationContext(...)`
- `fetchUnshieldClaimsSummary(..., blockHashToBeAwareOf)`

That makes claimable summaries safe to refetch against the mined block once invalidated with context.

## Invalidation-Side Examples

The helper functions in `src/hooks/internal/transactionInvalidation.ts` show the intended pattern.

Example shape:

```ts
const filters = {
  queryKey,
  exact: false,
} as const;

if (!blockHashToBeAwareOf) {
  queryClient.invalidateQueries(filters);
  return;
}

invalidateQueriesWithContext(queryClient, filters, { blockHashToBeAwareOf });
```

This keeps the legacy behavior unchanged when no block hash is available.

## How To Apply This To Another Cache

When rolling this out to another mutation and its dependent queries, follow this checklist.

### 1. Identify the query key that is invalidated

Use the same `queryKey` or prefix that the existing invalidation already uses.

### 2. Make the invalidation helper context-aware

Accept an optional:

```ts
blockHashToBeAwareOf?: `0x${string}`
```

Then:

- call `queryClient.invalidateQueries(...)` when the block hash is absent
- call `invalidateQueriesWithContext(...)` when the block hash is present

### 3. Make the query function context-aware

Wrap the query function with:

```ts
withInvalidationContext<..., { blockHashToBeAwareOf: `0x${string}` }, ...>(...)
```

### 4. Thread the block hash into the read path

Pass:

```ts
invalidationContext?.blockHashToBeAwareOf;
```

into the lowest-level read helper that can wait for RPC awareness.

### 5. Keep the no-context path working

The query must still behave correctly during:

- initial loads
- manual refetches
- invalidations unrelated to transactions

If `invalidationContext` is `undefined`, the read path should remain the normal fast path.

## Constraints And Caveats

### Context is transient

Entries are removed only after a matching query consumes them.

If an invalidation happens and nothing refetches that key, the entry remains in the store until:

- the same key is overwritten by a later invalidation, or
- a matching query eventually consumes it

There is no TTL cleanup today.

### Matching is prefix-based

This is useful for partial invalidation keys, but it also means a broad invalidation key can match more queries than intended.

This is already noted in `invalidateConfidentialTokenBalanceQueries`, where `exact: false` may invalidate adjacent reads on the same contract prefix.

### The newest matching context wins

If multiple invalidations match the same query key, `findMatching(...)` picks the most recent one.

That is usually what we want for post-transaction refetches, but it is worth keeping in mind if multiple mutations can invalidate the same cache in quick succession.

### Only queries that opt in will use the block hash

Calling `invalidateQueriesWithContext(...)` is not enough by itself.

The query must also:

- be wrapped with `withInvalidationContext(...)`, and
- pass the context into a read path that understands `blockHashToBeAwareOf`

If either side is missing, the invalidation falls back to behaving like a normal invalidation.

## Mental Model

The simplest way to think about this pattern is:

- invalidation decides which cache should refetch
- invalidation context tells the next refetch what transaction state it must observe
- the query read path enforces that requirement before reading from RPC

So this is not a separate cache system. It is a thin, one-shot metadata channel attached to standard React Query invalidation.
