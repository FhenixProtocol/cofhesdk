---
'@cofhe/sdk': patch
---

fix(sdk): validate permit expiration and validity in decrypt builder pipelines

`decryptForTx` and `decryptForView` previously returned stored active permits without verifying `PermitUtils.isValid(permit)`. When an active permit expired, decrypt executions proceeded with the expired permit and reverted on-chain with `PermissionInvalid_Expired (0xed0764a1)` instead of failing fast on the client with `CofheErrorCode.PermitExpired`.

`getResolvedPermit()` in `DecryptForTxBuilder` and `DecryptForViewBuilder` now validates permit validity before proceeding with decryption.
