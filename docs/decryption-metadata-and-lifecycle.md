# Decryption metadata + read↔decrypt lifecycle coupling

Design spec. Two related changes that make confidential reads/decryptions
self-describing and internally consistent, plus the foundation for an
SDK-owned "decryption activity" (cards) hook.

Motivation came from a consumer (ltf-platform) building a two-stage
"Decryptions" debug view. To recognize the contract/method on each card it had
to (a) parse the react-query key positionally, (b) keep a side ctHash→address
registry, and (c) infer the fetch↔decrypt join by ctHash. All three are
inference/side-channels. The SDK is the one place that actually knows these
facts at the moment it builds the queries — so it should state them.

A second issue surfaced: when a previously-successful read starts failing, its
cached ctHash lingers and the decrypt keeps running off it — so a fetch failure
is masked by a stale decrypted value, and observers see contradictory state
("fetch failed" and "fetched → decrypt failed" for the same value).

---

## Part 1 — Structured, consumer-extensible metadata

### Types

```ts
// Consumer-facing: the ONLY metadata type an app author touches. Fully generic —
// not token-specific. Optional everywhere.
export interface CofheDecryptMeta {
  /** Human label for this value in debug/activity views: a token symbol, "Vault
   *  balance", "Bid #42", "Round 7 tally" — anything. */
  label?: string;
  /** Any extra fields the consumer wants carried onto the card. */
  [key: string]: unknown;
}

// Internal: attached by the SDK to each query's `meta`, read by observers.
// The consumer never constructs this.
export interface CofheQueryMeta {
  kind: 'cofheRead' | 'cofheDecrypt'; // which stage
  chainId?: number;
  address?: `0x${string}`; // contract (method context — generic, any read has it)
  functionName?: string; // method
  ctHash?: string; // decrypt stage
  correlationId?: string; // SDK-managed; see note — start WITHOUT it
  consumer?: CofheDecryptMeta; // the app's meta, namespaced
}
```

Rationale for the split: structural facts (kind/address/functionName/ctHash/
correlation) are the SDK's to fill; the consumer surface is a tiny generic bag.
`tokenSymbol` deliberately does NOT exist — it collapses into `consumer.label`,
so non-token encrypted values are first-class.

### Transport

react-query's native `meta` field (already used via `useInternalQuery`). No new
machinery: `useQuery({ meta })` → readable from the cache as `query.meta`.

### Hook changes

- `useCofheReadContract(params, queryOptions)` — attach
  `meta: { kind: 'cofheRead', chainId, address, functionName }`.
- `useCofheDecrypt({ input, meta? }, queryOptions)` — accept optional
  `meta: CofheDecryptMeta`; attach
  `meta: { kind: 'cofheDecrypt', ctHash, consumer: meta }`.
- `useCofheReadContractAndDecrypt(params, opts)` — thread a `meta` through, and
  copy `address`/`functionName` from the read into the decrypt's meta so a
  decrypt row carries its source contract/method without a registry.
- `useCofheTokenDecryptedBalance({ token, accountAddress, meta? })` — auto-derive:
  `address`/`functionName` from the token's confidential-balance config, and
  `consumer.label = meta?.label ?? token.symbol`. Consumer `meta` is merged and
  wins on conflict.

### Auto-fill rule

- `address` / `functionName`: always from the read config (every read has them).
- `label`: defaulted to `token.symbol` in the token hooks only; otherwise unset
  unless the consumer provides it.
- Consumer `meta` overrides defaults.

### correlationId — SDK-internal, and probably unnecessary at first

The read returns the ctHash that becomes the decrypt's query key, so **ctHash
already links the two stages as ground truth**. Start WITHOUT `correlationId`
and join by ctHash. Only introduce it if a case appears where one read fans out
to multiple decrypts, or timing breaks the ctHash link. Either way it stays out
of `CofheDecryptMeta`.

---

## Part 2 — Read↔decrypt lifecycle coupling (stale-ctHash fix)

### Cause

`useCofheReadContractAndDecrypt` today:

```ts
const encryptedData = encrypted.data; // survives an error (react-query keeps last data)
const asEncryptedReturnType = encryptedData ? convert(encryptedData) : undefined;
const decrypted = useCofheDecrypt({ input: asEncryptedReturnType });
```

The decrypt input is gated on **data presence**, not the read's **current
status**. When a read starts failing but retains stale data, the decrypt keeps
running off the old ctHash. Result: the fetch failure is masked (the app shows a
stale decrypted value), and any observer sees two contradictory cache entries
for the same value.

### Fix

1. **Gate on success, not data presence:**
   ```ts
   const asEncryptedReturnType = encrypted.status === 'success' && encryptedData ? convert(encryptedData) : undefined;
   ```
   On read error the decrypt input becomes `undefined` → the composite reflects
   the fetch failure instead of a phantom "fetched".
2. **Evict the superseded decrypt** when the ctHash changes or the read errors:
   `queryClient.removeQueries({ queryKey: constructDecryptKey(prevCtHash) })`.

### Policy decision to make explicit

When a read errors but has last-known-good data: keep showing the stale value
(resilient to transient blips, but can mask staleness) vs drop to the error
(fresh, but flickers). The SDK currently does the former **silently** — the
worst option. Whichever default we pick, the composite result must **expose read
error / stale-value** so the consumer (or the cards hook) can decide, e.g.:

```ts
return {
  ...,
  isReadError: encrypted.isError,
  isValueStale: encrypted.isError && encryptedData != null, // showing a value from a failing read
};
```

---

## Part 3 — (future) SDK-owned decryption activity hook

Once Parts 1–2 land, lift the observer into the SDK:

```ts
useCofheDecryptionActivity(): DecryptionActivityRow[]
// row: { stage state (fetching/fetched/decrypting/decrypted/blocked/stale/error),
//        meta: CofheQueryMeta, ctHash, timings, retry() }
```

Consumers render only. The prototype is ltf-platform's `useDecryptionPipeline`;
it lives on the wrong side of the boundary today. Part 1's meta is exactly what
makes this hook's rows ground-truth instead of inferred.

---

## Rollout

1. Implement Parts 1 + 2 in the SDK behind a local link from the consumer.
2. Consumer keeps its current recognition as a **fallback**: read `query.meta`
   when present, else fall back to key-parsing/registry. Ship immediately.
3. Publish an alpha, re-pin the consumer, then delete the consumer fallback +
   the ctHash→address registry.
4. Part 3 later.

## Backward compatibility

All additive/optional: `meta` params optional; `CofheQueryMeta` is new. The one
behavioral change is the Part 2 gating in `useCofheReadContractAndDecrypt` —
either make it the default (changelog note) or guard behind an option
(`keepLastValueOnReadError`) during the transition.
