---
'@cofhe/sdk': patch
---

Fix `checkPermitValidityOnChain` throwing an empty `Error` and discarding the original error when a revert cannot be decoded against the ABI. The unnamed-error path now falls through to the remaining decoding strategies, and all thrown errors carry the original error as `cause`.
