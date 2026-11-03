---
'@cofhe/sdk': patch
---

Corrects `encryptInputs` to encrypt in the security zone given to `Encryptable` (e.g. `Encryptable.uint32(5n, 1)`) and to throw `ZkPackFailed` for inputs from different zones. Previously the input's zone was ignored and the value was encrypted in zone 0.
