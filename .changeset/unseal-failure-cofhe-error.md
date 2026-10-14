---
'@cofhe/sdk': patch
---

`unsealWithPrivateKey` now throws a `CofheError` with code `SealOutputFailed` when a sealed decrypt response cannot be unsealed (wrong key, tampered payload, or malformed nonce/key bytes). Previously it threw a plain `Error('Failed to decrypt message')` or a raw `tweetnacl` error, so `decryptForView` consumers could not branch on `error.code`, and `useCofheDecrypt` retried the deterministic failure, re-requesting the threshold network each time.
