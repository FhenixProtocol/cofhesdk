---
"@cofhe/sdk": patch
"@cofhe/site": patch
---

Decrypt/sealoutput failures now map the threshold network's stable `error` codes to dedicated `CofheErrorCode` values (e.g. `PermitDenied`, `CtNotFound`, `UnsupportedType`) instead of a generic `DecryptFailed`/`SealOutputFailed`, and `CofheError` gains an `apiErrorCode` field with the raw backend string.

Also fixes submit-time `404` retries: a `404` is only retried while the backend reports `ct_not_found` (still indexing); any other error code now fails immediately instead of being blindly retried for up to `set404RetryTimeout`.
