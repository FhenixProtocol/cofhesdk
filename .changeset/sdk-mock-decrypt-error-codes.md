---
'@cofhe/sdk': patch
---

Decrypts on the mocks now fail with the same error codes as the threshold network: a rejected ACP throws `ACPDenied`, `ACPExpired` or `ACPInvalid`, and `decryptForTx().withoutACP()` on a value that is not public throws `NotPubliclyAllowed`, each with its `apiErrorCode`. Previously every mock rejection was a generic `SealOutputFailed` or `DecryptFailed`.
