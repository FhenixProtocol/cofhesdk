---
'@cofhe/mock-contracts': patch
---

`MockTaskManager.createRandomTask` now stores `0` or `1` for a random `ebool`. Previously it stored a random byte (for example `66`), so `FHE.select` took the false branch while the value decrypted as `true`, and publishing the decrypt result as an `ebool` reverted with `InvalidSigner`.
