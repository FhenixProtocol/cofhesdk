---
'@cofhe/sdk': patch
---

Adds `httpStatus` to `CofheError` when the error comes from a verifier or threshold network response. Previously the status was dropped: a batch the verifier rejected with 400 surfaced only as `ZK_VERIFY_FAILED` with the response text in the message.
