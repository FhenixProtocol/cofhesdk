# @cofhe/foundry-plugin

## 0.7.2

### Patch Changes

- @cofhe/mock-contracts@0.7.2

## 0.7.1

### Patch Changes

- e907d8c: **Pin `@fhenixprotocol/cofhe-contracts` to the stable `0.2.0`.** 0.7.0 shipped against the
  `0.2.0-beta.3` prerelease; `0.2.0` is now released and is what `fhenix-confidential-contracts@0.4.0`
  depends on exactly, so keeping the beta pin resolved two copies of `FHE.sol` in any project using
  both. Nothing consumer-facing is removed between the two — `isAllowed` becomes `view` (which the
  mocks already were), and `FHE.div`/`rem` on `euint64` plus `FHE.mul`/`div`/`rem`/`square` on
  `euint128` are added. The `@cofhe/hardhat-plugin` peer range moves to `>=0.2.0`.
- Updated dependencies [e907d8c]
  - @cofhe/mock-contracts@0.7.1

## 0.7.0

### Minor Changes

- fb87d91: **Breaking: Permit (V2) → ACP (Access Control Permission).** Permits become scoped, revocable ACPs; old names are removed rather than deprecated. Highlights (full list in the [0.7.0 migration guide](https://cofhesdk.fhenix.io/migrating-to-0-7-0)):

  - `Permit`/`Permission`/`PermitUtils`/`client.permits` → `ACP`/`ACPPublic`/`ACPUtils`/`client.acp`; `getPermission()` → `getPublic()`
  - `ACPPrivate` & `ACPPublic` are top-level types, `ACP` is the union; the sealing keypair is flattened to `sealingPrivateKey`/`sealingKey` (the `SealingKey` class is removed)
  - New scope fields (`scope`, `contracts`, `handles: bytes32[]`) and revocation fields renamed `validatorId`/`validatorContract` → `revokerData`/`revokerContract`; default revoker `ACPTimestampRevoker` with `revokeACP`/`revokeAllACPs`/`isACPRevoked` on the client
  - EIP-712 domain bumped to `("ACL", "2")` with new `ACPIssuerSelf`/`ACPIssuerShared`/`ACPRecipient` types — previously signed permits no longer verify; the permit store migrates by wiping retired-format permits
  - `ACPUtils.export()` produces a fixed `SharedACP` shape and only accepts signed sharing ACPs

- fb87d91: **On-chain ACP sharing.** New `ACPShareRegistry` contract (deployed with the mocks) lets an issuer post a sharing ACP on-chain for its recipient to discover and import — replacing the JSON copy-paste hand-off.

  - `client.acp.shareOnChain(acp)` posts a signed sharing ACP (issuer-only, same guards as `export()`); `cancelShare(shareId)` retracts it
  - `client.acp.getIncomingShares()` lists importable shares addressed to the connected account (unexpired, not revoked — the registry checks the share's own revoker)
  - `client.acp.importFromChain(share)` imports like the JSON flow (recipient sealing key + signature); `dismissShare(shareId)` cleans up the entry
  - config: `acp.sharingRegistry: Record<chainId, address>`
  - registry exposes `isShareValid(shareId)` as an on-chain verification hook for contracts

- fb87d91: Migrate `cofheClient.encryptInputs` from one-signature-per-ciphertext to the new batch verification scheme (one signature per batch, per `FhenixProtocol/cofhe-contracts#78`).

  **Breaking:** `EncryptInputsBuilder.execute()` now always returns `[...hashes, signature]` (`HashPlusProofResult<T>`) instead of an array of per-item `EncryptedItemInput` structs. `EncryptedItemInput` and its per-type aliases (`EncryptedBoolInput`, `EncryptedUint8Input`, etc.) are removed, along with `EncryptInputsBuilder.asHashPlusProof()` (no longer needed - it's the only shape now). `@cofhe/abi`'s `extractEncryptableValues`/`insertEncryptedValues` now detect `external*` ABI types instead of `struct InEuintXX`, with a new calling convention: any function with encrypted inputs must end with a plain `bytes` parameter to receive the shared batch signature. `@cofhe/foundry-plugin`'s `CofheClient.createIn*` helpers are renamed to `createExternal*` (`createInEuint32` → `createExternalEuint32`, etc.) and now return an `external*` handle plus a batch signature rather than an `InEuintXX` struct; the `createIn*_asHashPlusProof` variants are removed as redundant. See the [0.7.0 migration guide](https://cofhesdk.fhenix.io/migrating-to-0-7-0) for the full list of changes and what contract authors need to update.

- fb87d91: Bind encrypted inputs to a consuming contract (`FhenixProtocol/cofhe-contracts#77`). The verifier-signed digest now includes the contract that will consume the ciphertext, closing a replay path where a signed input packet observed on-chain could be reused against a different contract than the one it was signed for.

  **Breaking:** `EncryptInputsBuilder.setConsumingContract(address)` must be called before `.execute()` - it throws `ConsumingContractUninitialized` otherwise. `@cofhe/mock-contracts`'s `MockTaskManager` signature digest changed to include the consuming contract (external ABI unchanged). `@cofhe/foundry-plugin`'s `CofheClient.createExternal*`/`createEuint32sBatch` helpers now take a required `address consumingContract` as their last parameter (no global setter). `@cofhe/react`'s `useCofheEncryptAndWriteContract` defaults `consumingContract` to the write's target address automatically; `useCofheEncrypt` accepts it as an explicit option. See the [0.7.0 migration guide](https://cofhesdk.fhenix.io/migrating-to-0-7-0) for full details.

### Patch Changes

- Updated dependencies [fb87d91]
- Updated dependencies [fb87d91]
- Updated dependencies [fb87d91]
- Updated dependencies [fb87d91]
- Updated dependencies [fb87d91]
  - @cofhe/mock-contracts@0.7.0

## 0.6.1

### Patch Changes

- @cofhe/mock-contracts@0.6.1

## 0.6.0

### Patch Changes

- Updated dependencies [566f126]
  - @cofhe/mock-contracts@0.6.0

## 0.5.2

### Patch Changes

- @cofhe/mock-contracts@0.5.2

## 0.5.1

### Patch Changes

- Updated dependencies [342fd0f]
  - @cofhe/mock-contracts@0.5.1

## 0.5.0

### Patch Changes

- a685cd4: **Breaking change: upgraded to tfhe v1.5.3.**
  Previous cofhesdk versions will no longer function.
- Updated dependencies [50bb3e4]
- Updated dependencies [a685cd4]
  - @cofhe/mock-contracts@0.5.0
