# @cofhe/abi Changelog

## 0.7.2

### Patch Changes

- @cofhe/sdk@0.7.2

## 0.7.1

### Patch Changes

- @cofhe/sdk@0.7.1

## 0.7.0

### Minor Changes

- fb87d91: Migrate `cofheClient.encryptInputs` from one-signature-per-ciphertext to the new batch verification scheme (one signature per batch, per `FhenixProtocol/cofhe-contracts#78`).

  **Breaking:** `EncryptInputsBuilder.execute()` now always returns `[...hashes, signature]` (`HashPlusProofResult<T>`) instead of an array of per-item `EncryptedItemInput` structs. `EncryptedItemInput` and its per-type aliases (`EncryptedBoolInput`, `EncryptedUint8Input`, etc.) are removed, along with `EncryptInputsBuilder.asHashPlusProof()` (no longer needed - it's the only shape now). `@cofhe/abi`'s `extractEncryptableValues`/`insertEncryptedValues` now detect `external*` ABI types instead of `struct InEuintXX`, with a new calling convention: any function with encrypted inputs must end with a plain `bytes` parameter to receive the shared batch signature. `@cofhe/foundry-plugin`'s `CofheClient.createIn*` helpers are renamed to `createExternal*` (`createInEuint32` → `createExternalEuint32`, etc.) and now return an `external*` handle plus a batch signature rather than an `InEuintXX` struct; the `createIn*_asHashPlusProof` variants are removed as redundant. See the [0.7.0 migration guide](https://cofhesdk.fhenix.io/migrating-to-0-7-0) for the full list of changes and what contract authors need to update.

- fb87d91: Find the batch-signature parameter by pairing instead of position: it is now the plain `bytes` immediately after the contiguous run of `external*` inputs, not necessarily the function's last parameter. ERC-7984-style `*AndCall` ABIs (`..., externalEuint64 amount, bytes inputProof, bytes data`) now work in `extractEncryptableValues` / `insertEncryptedValues` / `useCofheEncryptAndWriteContract`, and `CofheInputArgsPreTransform` drops that slot wherever it sits. Non-adjacent `external*` inputs now throw — they share one signature, so there is no unambiguous slot. ABIs with the signature already last are unaffected.

### Patch Changes

- Updated dependencies [fb87d91]
- Updated dependencies [fb87d91]
- Updated dependencies [fb87d91]
- Updated dependencies [fb87d91]
- Updated dependencies [fb87d91]
- Updated dependencies [d4d662f]
- Updated dependencies [fb87d91]
- Updated dependencies [f01cac7]
  - @cofhe/sdk@0.7.0

## 0.6.1

### Patch Changes

- Updated dependencies [670cda8]
  - @cofhe/sdk@0.6.1

## 0.6.0

### Patch Changes

- Updated dependencies [bf23270]
- Updated dependencies [2711f9b]
- Updated dependencies [566f126]
  - @cofhe/sdk@0.6.0

## 0.5.2

### Patch Changes

- Updated dependencies [2fbb918]
  - @cofhe/sdk@0.5.2

## 0.5.1

### Patch Changes

- Updated dependencies [342fd0f]
  - @cofhe/sdk@0.5.1

## 0.5.0

### Patch Changes

- a685cd4: **Breaking change: upgraded to tfhe v1.5.3.**
  Previous cofhesdk versions will no longer function.
- Updated dependencies [6c4084f]
- Updated dependencies [788a6e2]
- Updated dependencies [9a06012]
- Updated dependencies [503536a]
- Updated dependencies [a685cd4]
  - @cofhe/sdk@0.5.0

## 0.4.0

### Patch Changes

- Updated dependencies [e446642]
  - @cofhe/sdk@0.4.0

## 0.3.2

### Patch Changes

- d4e86ea: Aligns with CTA encrypted variables bytes32 representation.

  - **@cofhe/hardhat-plugin**: `hre.cofhe.mocks.getTestBed()`, `getMockTaskManager()`, `getMockACL()`, `getMockThresholdNetwork()`, and `getMockZkVerifier()` now return typed contracts (typechain interfaces) instead of untyped `Contract`. `getPlaintext(ctHash)` and `expectPlaintext(ctHash, value)` now accept bytes32 ctHashes as `string` support cofhe-contracts 0.1.0 CTA changes.
  - **@cofhe/mock-contracts**: Export typechain-generated contract types (`TestBed`, `MockACL`, `MockTaskManager`, `MockZkVerifier`, `MockThresholdNetwork`) for use with the hardhat plugin. Typechain is run from artifact ABIs only; factory files are not generated.
  - **@cofhe/abi**: CTA-related types use `bytes32` (string) instead of `uint256`. Decryption and return-type helpers aligned with cofhe-contracts 0.1.0.
  - **@cofhe/sdk**: Decryption APIs (`decryptForTx`, `decryptForView`, and related builders) now also accept `string` for ciphertext hashes (bytes32) as well as `bigint`.

- Updated dependencies [d4e86ea]
- Updated dependencies [0feaf3f]
  - @cofhe/sdk@0.3.2

## 0.3.1

### Patch Changes

- 370f0c7: no-op
- Updated dependencies [370f0c7]
  - @cofhe/sdk@0.3.1

## 0.3.0

### Patch Changes

- Updated dependencies [35024b6]
- Updated dependencies [5467d77]
- Updated dependencies [73b1502]
- Updated dependencies [29c2401]
- Updated dependencies [650ea48]
  - @cofhe/sdk@0.3.0

## 0.2.1

### Patch Changes

- be9bfd9: Fix deployment include `dist` folder.
- Updated dependencies [409bfdf]
- Updated dependencies [ac47e2f]
- Updated dependencies [8af1b70]
  - @cofhe/sdk@0.2.1

## 0.2.0

### Patch Changes

- Updated dependencies [8fda09a]
- Updated dependencies [4057a76]
- Updated dependencies [dba2759]
- Updated dependencies [e0caeca]
- Updated dependencies [7c861af]
- Updated dependencies [2a9d6c5]
  - @cofhe/sdk@0.2.0
