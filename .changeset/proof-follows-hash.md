---
'@cofhe/abi': minor
---

Find the batch-signature parameter by pairing instead of position: it is now the plain `bytes` immediately after the contiguous run of `external*` inputs, not necessarily the function's last parameter. ERC-7984-style `*AndCall` ABIs (`..., externalEuint64 amount, bytes inputProof, bytes data`) now work in `extractEncryptableValues` / `insertEncryptedValues` / `useCofheEncryptAndWriteContract`, and `CofheInputArgsPreTransform` drops that slot wherever it sits. Non-adjacent `external*` inputs now throw — they share one signature, so there is no unambiguous slot. ABIs with the signature already last are unaffected.
