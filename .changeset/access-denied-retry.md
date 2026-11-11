---
'@cofhe/sdk': minor
---

Adds `setAccessDeniedRetryTimeout(timeoutMs)` to `decryptForView` and `decryptForTx`. A decrypt sent right after the transaction that grants access can be refused for a moment, because the network has not seen that transaction yet. With this option the SDK keeps asking for up to `timeoutMs` instead of failing on the first `ACPDenied` or `NotPubliclyAllowed`. It is off by default (`0`), so existing calls behave as before. [Docs](https://cofhesdk.fhenix.io/reference/decryption-lifecycle)
