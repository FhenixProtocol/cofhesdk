---
'@cofhe/mock-contracts': patch
---

Corrects `MockZkVerifier` to give every input of an `encryptInputs` batch its own ctHash. Previously equal values encrypted together, such as `[Encryptable.uint32(9n), Encryptable.uint32(9n)]`, came back with the same ctHash on Hardhat.
