---
'@cofhe/sdk': patch
---

Use a supplied permit's signed chain ID when selecting the threshold network and constructing `decryptForView` and `decryptForTx` requests. This lets callers use a provided permit without setting a builder chain and prevents a stale builder chain from routing the request to the wrong network.
