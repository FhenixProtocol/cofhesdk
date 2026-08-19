---
'@cofhe/sdk': minor
'@cofhe/abi': minor
'@cofhe/mock-contracts': minor
'@cofhe/react': minor
'@cofhe/foundry-plugin': minor
---

Migrate `cofheClient.encryptInputs` from one-signature-per-ciphertext to the new batch verification scheme (one signature per batch, per `FhenixProtocol/cofhe-contracts#78`).

**Breaking:** `EncryptInputsBuilder.execute()` now always returns `[...hashes, signature]` (`HashPlusProofResult<T>`) instead of an array of per-item `EncryptedItemInput` structs. `EncryptedItemInput` and its per-type aliases (`EncryptedBoolInput`, `EncryptedUint8Input`, etc.) are removed, along with `EncryptInputsBuilder.asHashPlusProof()` (no longer needed - it's the only shape now). `@cofhe/abi`'s `extractEncryptableValues`/`insertEncryptedValues` now detect `external*` ABI types instead of `struct InEuintXX`, with a new calling convention: any function with encrypted inputs must end with a plain `bytes` parameter to receive the shared batch signature. `@cofhe/foundry-plugin`'s `CofheClient.createIn*` helpers are renamed to `createExternal*` (`createInEuint32` → `createExternalEuint32`, etc.) and now return an `external*` handle plus a batch signature rather than an `InEuintXX` struct; the `createIn*_asHashPlusProof` variants are removed as redundant. See the [0.7.0 migration guide](https://cofhesdk.fhenix.io/migrating-to-0-7-0) for the full list of changes and what contract authors need to update.
