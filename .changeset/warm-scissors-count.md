---
'@cofhe/react': minor
'@cofhe/sdk': minor
---

Align builder patterns in cofhe client api (`client.encryptInputs(..).encrypt()` and `client.decryptHandles(..).decrypt()`) to use the same terminator function `.execute()` instead of `.encrypt()`/`.decrypt()`.

Rename `setStepCallback` of encryptInputs builder to `onStep` to improve ergonomics.
