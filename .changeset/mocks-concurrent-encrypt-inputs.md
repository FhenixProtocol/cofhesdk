---
'@cofhe/sdk': patch
---

Corrects `encryptInputs` on a mocks chain to give concurrent encrypts their own ctHash. Previously two `encryptInputs([Encryptable.uint32(9n)])` calls run with `Promise.all` came back with the same ctHash, or the second rejected with `ZkMocksInsertCtHashesFailed` ("Nonce too low").
