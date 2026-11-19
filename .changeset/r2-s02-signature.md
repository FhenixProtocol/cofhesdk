---
'@cofhe/sdk': patch
---

Corrects `normalizeTnSignature` to wrap a malformed threshold-network signature in a `CofheError`. Previously viem's raw parse error escaped, so the decrypt hook retried it as a transient failure instead of failing fast.
