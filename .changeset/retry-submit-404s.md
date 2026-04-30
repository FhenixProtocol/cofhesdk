---
'@cofhe/sdk': patch
'@cofhe/site': patch
---

Retry transient submit-time `404 Not Found` responses in the threshold-network decryption flows used by `decryptForTx` and `decryptForView`.

This adds a configurable `.set404RetryTimeout(timeoutMs)` builder option, defaults the retry window to 10 seconds, and keeps `decrypt` and `sealoutput` submit retry behavior aligned.

Update the decryption docs to explain submit-time `404` retries, empty `requestId` values during request creation, and when to increase the retry timeout for slower backends.
