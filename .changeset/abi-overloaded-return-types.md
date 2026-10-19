---
'@cofhe/abi': patch
'@cofhe/react': patch
---

**@cofhe/abi**

`transformEncryptedReturnTypes` takes the call's `args` as an optional fourth parameter and uses the outputs of the overload they select. Previously it used the first ABI entry with that name, so for an overloaded view a plaintext `5n` could come back as `{ ctHash: 5n, utype: FheTypes.Uint64 }`, or an encrypted result as a raw `bytes32`.

**@cofhe/react**

`useCofheReadContract` passes its `args`, so reads of overloaded view functions return the result of the overload that was called.
