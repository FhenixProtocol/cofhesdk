---
'@cofhe/react': patch
'@cofhe/sdk': patch
---

Add `hash` field to permits, calculated at permit creation time. Replaces `PermitUtils.getHash(permit)` with `permit.hash`.
