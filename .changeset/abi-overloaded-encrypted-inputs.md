---
'@cofhe/abi': patch
---

For overloaded functions, `extractEncryptableValues` and `insertEncryptedValues` (and so `useCofheEncryptAndWriteContract`) now pick the overload by argument count, preferring the one with encrypted inputs. Previously they took the first ABI entry with that name, which could send the value unencrypted.
