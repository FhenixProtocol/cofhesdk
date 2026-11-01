---
'@cofhe/react': patch
---

Corrects `CofheEncryptInput` to encrypt the bool type and to pass the batch signature on with the handle. Previously selecting bool always failed with "Bool encryptable data must be boolean", because the typed text was passed to `Encryptable.create('bool', ...)` as a string, and `onEncryptComplete` and the copy button returned only the handle, without the signature the consuming contract needs to verify it. `encrypted` is now `[handle, signature]`, as returned by `useCofheEncrypt`.
