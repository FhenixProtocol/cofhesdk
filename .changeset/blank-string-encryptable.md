---
'@cofhe/sdk': patch
---

Corrects `Encryptable` string inputs to reject empty or whitespace-only values. Previously `Encryptable.uint64('')` was encrypted as `0`.
