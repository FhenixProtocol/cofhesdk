---
'@cofhe/react': minor
'@cofhe/sdk': minor
---

**@cofhe/react**

- New `useCofheDecrypter`: its `decryptForView` decrypts one handle on demand, for a job over many handles (a history to sum, a set of bids to reveal) run from a click handler. Each call is the same query `useCofheDecrypt` runs — same cache key, same ACP gate, same persistence, same activity row — so a handle decrypted either way is decrypted once. Calls run at most `concurrency` at a time (4 by default). Its `decryptForTx` is the same for a proof. [Docs](https://cofhesdk.fhenix.io/react/decrypt#usecofhedecrypter--a-job-over-many-handles)
- New `useCofheDecryptForTx`: a query around `client.decryptForTx` — the plaintext with the threshold network's signature, for a contract to verify. A proof is a read (the contract checks only `(ctHash, value, signature)`), so it is cached under `[chainId, ctHash, acpHash]` with `staleTime: Infinity`, persisted under the same rule as a view decrypt, and can be fetched on the page before the transaction is sent; `acp: null` decrypts a publicly allowed handle without an ACP. [Docs](https://cofhesdk.fhenix.io/react/decrypt#usecofhedecryptfortx--a-plaintext-with-proof)
- `useCofheDecrypt` takes `timeoutMs`, the decrypt's whole budget. `cofheDecryptForViewQuery` / `cofheDecryptForTxQuery` and their key constructors are exported, for a `queryClient` call of your own.

**@cofhe/sdk**

- New `.setTimeout(timeoutMs)` on `decryptForView` and `decryptForTx`: the whole budget of one decrypt, submit retries and status polling together. Previously it was fixed at 5 minutes, which stays the default. [Docs](https://cofhesdk.fhenix.io/sdk/decrypt-to-view#settimeouttimeoutms--optional)
