---
'@cofhe/sdk': patch
---

Corrects `createCofheConfig` to keep the `fheKeyStorage` object it was given. Previously it copied the three methods onto a new object, so a storage written as a class lost `this` and every `encryptInputs` call failed with `REHYDRATE_KEYS_STORE_FAILED`.
