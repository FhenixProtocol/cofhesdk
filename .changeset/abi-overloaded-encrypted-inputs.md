---
'@cofhe/abi': patch
---

`extractEncryptableValues` and `insertEncryptedValues` now pick the right overload when a function name is overloaded. They used to take the first ABI entry with that name, which for compiler output is often the plaintext overload, so `useCofheEncryptAndWriteContract` could send the raw value unencrypted.
