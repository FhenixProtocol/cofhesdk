---
'@cofhe/sdk': patch
---

Throw `CofheErrorCode.ChainIdMismatch` from `decryptForView` and `decryptForTx` when the builder's `chainId` is set and differs from the ACP's signed `chainId`.
