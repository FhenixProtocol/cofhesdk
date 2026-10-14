---
'@cofhe/sdk': patch
---

`verifyDecryptResult` now returns `false` when the chain's TaskManager has no `decryptResultSigner` set (zero address). It used to return `true` for any signature in that case. The on-chain `verifyDecryptResult` still skips the check when no signer is set.
