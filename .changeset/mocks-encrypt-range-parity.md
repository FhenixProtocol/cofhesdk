---
'@cofhe/sdk': patch
---

`encryptInputs` on the Hardhat mocks now rejects out-of-range values with the same error as the production path. Previously the mocks only checked the total bit count, so for example `Encryptable.uint8(256n)` passed and `MockCoFHE` masked it to `0`, letting local tests pass while the same call threw `Value out of range` on a real network.
