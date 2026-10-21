---
'@cofhe/react': minor
'@cofhe/sdk': minor
---

**@cofhe/react**

- New `useCofheDecrypts`: `useCofheDecrypt` for a list, one query per handle in the order of `inputs`, with per-entry `meta`; a zero handle reads as the type's zero without a request.
- New `useCofheDecrypter`: its `decryptForView` decrypts one handle on demand, for a job over many handles (a history to sum, a set of bids to reveal) run from a click handler. Each call is the same query `useCofheDecrypt` runs — same cache key, same ACP gate, same persistence, same activity row — so a handle decrypted either way is decrypted once. Calls run at most `concurrency` at a time (4 by default). Its `decryptForTx` is the same for a proof.
- New `useCofheDecryptForTx`: a query around `client.decryptForTx` — the plaintext with the threshold network's signature, for a contract to verify. A proof is a read (the contract checks only `(ctHash, value, signature)`), so it is cached under `[chainId, ctHash, acpHash]` with `staleTime: Infinity`, persisted under the same rule as a view decrypt, and can be fetched on the page before the transaction is sent; `acp: null` decrypts a publicly allowed handle without an ACP.
- `useCofheDecrypt` takes `timeoutMs`, the decrypt's whole budget. `useCofheDecrypter`'s calls take `signal`, an `AbortSignal`: a call still waiting for a slot never starts, a request in flight is aborted, and the call rejects with `Aborted`. `cofheDecryptForViewQuery` / `cofheDecryptForTxQuery` and their key constructors are exported, for a `queryClient` call of your own.

**@cofhe/sdk**

- New `.setTimeout(timeoutMs)` on `decryptForView` and `decryptForTx`: the whole budget of one decrypt, submit retries and status polling together. Previously it was fixed at 5 minutes, which stays the default.
- New `decryptConcurrency` config option (8 by default, `Infinity` disables): a client sends at most that many decrypts to the threshold network at a time, further calls wait their turn, so a list decrypted at once needs no limiter of its own.
- New `.setSignal(signal)` on both: an `AbortSignal` that stops the decrypt at its next await, aborting the pending request; `execute()` then rejects with the new `CofheErrorCode.Aborted`.
