---
'@cofhe/sdk': patch
---

Corrects `clearKeysStorage` on `createKeysStore` to also clear the keys held in memory. Previously `getFheKey` still returned the cleared key, and the next `setFheKey` or `setCrs` wrote it back to storage.
