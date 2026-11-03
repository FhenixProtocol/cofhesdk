---
'@cofhe/sdk': patch
---

Corrects `decryptForView` and `decryptForTx` to throw `CofheErrorCode.ChainIdMismatch` when the builder's `chainId` is set and differs from the chain the ACP was signed for, before anything is sent to the threshold network. Previously the ACP's chain silently won and the request failed later, or against the wrong chain. Adds `ChainIdMismatch` to the `CofheErrorCode` enum, so an exhaustive `switch` or `Record<CofheErrorCode, …>` over it needs a new case.
