---
'@cofhe/sdk': patch
---

`verifyDecryptResult` now returns `false` for signature encodings the TaskManager rejects. It used to return `true` for a valid signature re-encoded with `v` of 0 or 1 or with a high `s` value, while the on-chain `verifyDecryptResult` and `publishDecryptResult` revert with `InvalidSignature` for both (OpenZeppelin `ECDSA.tryRecover`).
