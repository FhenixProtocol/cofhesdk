---
'@cofhe/sdk': patch
---

Corrects `verifyDecryptResult` to return `false` for signatures that the on-chain `TaskManager` would reject: anything other than 65 bytes with `v` of 27 or 28 and a low `s` value. Previously a re-encoded but genuine signature verified off-chain and reverted on-chain with `InvalidSignature`.
