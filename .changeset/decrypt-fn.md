---
'@cofhe/react': minor
'@cofhe/sdk': minor
---

**@cofhe/react**

- New `useCofheDecryptFn`: a function that decrypts one handle on demand, for a job over many handles (a history to sum, a set of bids to reveal) run from a `useMutation`. Each call is the same query `useCofheDecrypt` runs — same cache key, same ACP gate, same persistence, same activity row — so a handle decrypted either way is decrypted once. Calls run at most `concurrency` at a time (4 by default). [Docs](https://cofhesdk.fhenix.io/react/decrypt#usecofhedecryptfn--a-job-over-many-handles)
- New `useCofheDecryptForTx`: a mutation hook around `client.decryptForTx`, shaped like `useCofheEncrypt` (`decryptForTxAsync`, `isDecrypting`); `acp: null` decrypts a publicly allowed handle without an ACP. [Docs](https://cofhesdk.fhenix.io/react/decrypt#usecofhedecryptfortx--a-plaintext-with-proof)
- `useCofheDecrypt` takes `timeoutMs`, the decrypt's whole budget.

**@cofhe/sdk**

- New `.setTimeout(timeoutMs)` on `decryptForView` and `decryptForTx`: the whole budget of one decrypt, submit retries and status polling together. Previously it was fixed at 5 minutes, which stays the default. [Docs](https://cofhesdk.fhenix.io/sdk/decrypt-to-view#settimeouttimeoutms--optional)
