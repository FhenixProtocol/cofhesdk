---
'@cofhe/abi': patch
'@cofhe/react': patch
---

**@cofhe/abi**

Corrects `transformEncryptedReturnTypes` to read the outputs of the overload selected by the call's `args`, now accepted as an optional fourth parameter. Previously it used the first ABI entry with that name, so a plaintext `5n` from an overloaded view could come back as `{ ctHash: 5n, utype: FheTypes.Uint64 }`, or an encrypted result as a raw `bytes32`.

**@cofhe/react**

Corrects `useCofheReadContract` to return the result of the overload its `args` select when reading an overloaded view function.
