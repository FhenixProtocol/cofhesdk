---
'@cofhe/react': patch
---

`FheTypesList` now reports the exact `maxValue` for `uint64` and `uint128`. They were computed through a float (`BigInt(2 ** 64 - 1)`), which rounds to 2^64 and 2^128, so `CofheEncryptInput` accepted a value one above the type's range.
