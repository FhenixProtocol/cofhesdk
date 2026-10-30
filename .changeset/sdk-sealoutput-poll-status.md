---
'@cofhe/sdk': patch
---

Corrects `decryptForView` to fail with `SealOutputFailed` when the threshold network reports a status other than `PROCESSING` or `COMPLETED`. Previously an unknown status such as `FAILED` was treated as still processing and the call kept polling until the 5 minute timeout.
