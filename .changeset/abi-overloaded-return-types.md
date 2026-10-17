---
'@cofhe/abi': patch
'@cofhe/react': patch
---

For overloaded view functions, `transformEncryptedReturnTypes` (and so `useCofheReadContract`) now reads the outputs of the overload the args select. Previously it took the first ABI entry with that name, so a plaintext result could come back wrapped as an encrypted `{ ctHash, utype }`, or an encrypted one as a raw `bytes32`.
