---
'@cofhe/sdk': patch
---

`unsealWithPrivateKey` throws a `CofheError` with code `SealOutputFailed` when a decrypt response can't be unsealed, instead of a plain `Error`. `useCofheDecrypt` no longer retries these failures.
