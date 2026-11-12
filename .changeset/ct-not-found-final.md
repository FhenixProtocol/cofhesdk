---
'@cofhe/sdk': minor
---

A `404` from the decrypt submit endpoints is now final. `decryptForView` and `decryptForTx` fail with `CtNotFound` on the first `404` instead of retrying for 10 seconds, because a `404` means the network has no ciphertext for a handle the caller may read, and waiting does not fix that. `set404RetryTimeout(timeoutMs)` is deprecated and no longer has any effect; the call is still accepted and will be removed in a future major release. The hint on `CtNotFound` no longer says the ciphertext "may not be indexed yet", and the error for a result that never became ready now reads "result was not ready after retrying" where it said "submit retried without receiving request_id". [Docs](https://cofhesdk.fhenix.io/reference/decryption-lifecycle)
