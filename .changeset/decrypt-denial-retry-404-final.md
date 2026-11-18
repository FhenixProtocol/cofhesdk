---
'@cofhe/sdk': minor
---

Adds `setAccessDeniedRetryTimeout(timeoutMs)` to `decryptForView` and `decryptForTx`. With it, a decrypt sent right after the transaction that grants access keeps asking for up to `timeoutMs` while the network answers `ACPDenied` or `NotPubliclyAllowed`. Off by default (`0`). [Docs](https://cofhesdk.fhenix.io/reference/decryption-lifecycle)

Changes `decryptForView` and `decryptForTx` to fail with `CtNotFound` on the first `404`. Previously they retried it for 10 seconds.

Changes `decryptForView` and `decryptForTx` to take the result only from the response to the decrypt request. They no longer ask a status endpoint when a response has a `request_id` and no result; such a response now fails with `DecryptReturnedNull` or `SealOutputReturnedNull`. `onPoll` still runs before each retry.

Deprecates `requestId` in the `onPoll` callback context: it is always an empty string.

Deprecates `set404RetryTimeout`: the call is still accepted and has no effect. Remove it.
