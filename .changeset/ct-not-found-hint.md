---
'@cofhe/sdk': patch
---

Corrects the hint on the `CtNotFound` error thrown by `decryptForView` and `decryptForTx`. Previously it said the ciphertext "may not be indexed yet" and to increase `set404RetryTimeout(...)`, which does not help: a handle the network has not seen yet is refused with `ACPDenied`, not `CtNotFound`.
