---
'@cofhe/abi': patch
---

`extractEncryptableValues` and `insertEncryptedValues` now handle arrays of structs (`tuple[]` / `tuple[N]`): each element is walked as its own tuple, with fixed-size lengths enforced. Previously the array itself was processed as a single tuple, so the named-component lookups found nothing — extraction handed `undefined` to the encryptable transform instead of the real plaintext, and insertion consumed no hashes and collapsed the argument to `{}`. This broke any write taking a struct array (e.g. a batch submission taking `Order[]` through `useCofheWriteContract`), and dropped plain struct-array arguments even when they carried no encrypted fields. Mirrors the same fix made to `transformEncryptedReturnTypes` for struct-array returns.
