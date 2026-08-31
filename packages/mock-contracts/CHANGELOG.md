# @cofhe/mock-contracts Changelog

## 0.7.2

## 0.7.1

### Patch Changes

- e907d8c: **Pin `@fhenixprotocol/cofhe-contracts` to the stable `0.2.0`.** 0.7.0 shipped against the
  `0.2.0-beta.3` prerelease; `0.2.0` is now released and is what `fhenix-confidential-contracts@0.4.0`
  depends on exactly, so keeping the beta pin resolved two copies of `FHE.sol` in any project using
  both. Nothing consumer-facing is removed between the two — `isAllowed` becomes `view` (which the
  mocks already were), and `FHE.div`/`rem` on `euint64` plus `FHE.mul`/`div`/`rem`/`square` on
  `euint128` are added. The `@cofhe/hardhat-plugin` peer range moves to `>=0.2.0`.

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

- fb87d91: Add mock support for `sharedEuintXX` — contract-to-contract encrypted value movement, shipped in `@fhenixprotocol/cofhe-contracts@0.2.0-beta.3`.

  `MockACL` gains `shareCtHash(handle, sharer, receiver)` and `receiveCtHash(handle, expectedSharer, receiver)`, backed by a directed, single-use, transaction-scoped share slot (domain-separated from transient allowance keys), plus the `NotShared` and `UnexpectedSharer` errors. `MockTaskManager` gains the matching `shareCtHash`/`receiveCtHash` passthroughs with `MOCK_logAllow` hooks.

  `MockACL`'s transient allowances now use real EIP-1153 transient storage instead of approximating it with `block.number`, and `cleanTransientStorage()` is implemented rather than a no-op. This makes the mock faithful to the production ACL: **a transient allowance now expires at the end of its own transaction, not at the end of the block.** Tests that granted a transient allowance in one transaction and relied on it in a later transaction of the same block must be updated.

  The repo also drops the temporary `pnpm patch` that carried these `FHE.sol` / `ICofhe.sol` additions, and pins `@fhenixprotocol/cofhe-contracts@0.2.0-beta.3`.

## 0.6.1

## 0.6.0

### Minor Changes

- 566f126: Remove the legacy `TestBed` mock surface and stop auto-deploying `SimpleTest` through the Hardhat plugins. Core mock contracts still deploy automatically, while tests that need `SimpleTest` should deploy it explicitly from their own artifacts.

  This also removes `TEST_BED_ADDRESS` and cleans up duplicate `SimpleTest` exports from `@cofhe/mock-contracts`.

## 0.5.2

## 0.5.1

### Patch Changes

- 342fd0f: Fix SSR compatibility (`@cofhe/sdk/web` no longer crashes Next.js builds with `self is not defined`) by lazy-loading `tfhe`. Align `@cofhe/mock-contracts` with `@fhenixprotocol/cofhe-contracts@^0.1.3` (updated `TestBed.sol` to use current decrypt API, added missing `ITaskManager` batch methods to `MockTaskManager.sol`).

## 0.5.0

### Minor Changes

- 50bb3e4: Decode custom errors from deployed mock contracts by name instead of raw hex selectors.

  **`@cofhe/mock-contracts`**

  - Replaced transient storage (`tstore`/`tload`) in `MockACL.sol` with block-number-based storage, removing the EVM `cancun` requirement and lowering the Solidity pragma to `>=0.8.19`.
  - Removed `bytecode` and `deployedBytecode` fields from published artifacts — they are now sourced at runtime from Hardhat's own compilation output.

  **`@cofhe/hardhat-plugin`**

  - Overrides `TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS` to inject a stub file that imports all mock contracts, so Hardhat compiles them and registers their artifacts. This lets the Hardhat network decode mock contract custom errors by name (e.g. `PermissionInvalid_Expired`) rather than raw hex.
  - Deployment bytecode is now fetched from `hre.artifacts.readArtifact()` instead of the pre-built artifact bundle.

  **`@cofhe/hardhat-3-plugin`**

  - Calls `hre.solidity.build()` during the `hre.created` hook to compile mock contracts once at startup, enabling the EDR to decode their custom errors by name.
  - `deployFixed` and `deployVariable` now source bytecode from `hre.artifacts.readArtifact()`, ensuring the deployed bytecode matches Hardhat's build info — which is required for error decoding on variable-address contracts like `MockACL`.

### Patch Changes

- a685cd4: **Breaking change: upgraded to tfhe v1.5.3.**
  Previous cofhesdk versions will no longer function.

## 0.4.0

## 0.3.2

### Patch Changes

- d4e86ea: Aligns with CTA encrypted variables bytes32 representation.

  - **@cofhe/hardhat-plugin**: `hre.cofhe.mocks.getTestBed()`, `getMockTaskManager()`, `getMockACL()`, `getMockThresholdNetwork()`, and `getMockZkVerifier()` now return typed contracts (typechain interfaces) instead of untyped `Contract`. `getPlaintext(ctHash)` and `expectPlaintext(ctHash, value)` now accept bytes32 ctHashes as `string` support cofhe-contracts 0.1.0 CTA changes.
  - **@cofhe/mock-contracts**: Export typechain-generated contract types (`TestBed`, `MockACL`, `MockTaskManager`, `MockZkVerifier`, `MockThresholdNetwork`) for use with the hardhat plugin. Typechain is run from artifact ABIs only; factory files are not generated.
  - **@cofhe/abi**: CTA-related types use `bytes32` (string) instead of `uint256`. Decryption and return-type helpers aligned with cofhe-contracts 0.1.0.
  - **@cofhe/sdk**: Decryption APIs (`decryptForTx`, `decryptForView`, and related builders) now also accept `string` for ciphertext hashes (bytes32) as well as `bigint`.

## 0.3.1

### Patch Changes

- 370f0c7: no-op

## 0.3.0

### Minor Changes

- 35024b6: Remove `sdk` from function names and exported types. Rename:

  - `createCofhesdkConfig` -> `createCofheConfig`
  - `createCofhesdkClient` -> `createCofheClient`
  - `hre.cofhesdk.*` -> `hre.cofhe.*`
  - `hre.cofhesdk.createCofheConfig()` → `hre.cofhe.createConfig()`
  - `hre.cofhesdk.createCofheClient()` → `hre.cofhe.createClient()`
  - `hre.cofhesdk.createBatteriesIncludedCofheClient()` → `hre.cofhe.createClientWithBatteries()`

- 29c2401: implement decrypt-with-proof flows and related tests:

  - Implement production `decryptForTx` backed by Threshold Network `POST /decrypt`, with explicit permit vs global-allowance selection.
  - Rename mocks “Query Decrypter” -> “Threshold Network” and update SDK constants/contracts/artifacts accordingly.
  - Extend mock contracts + hardhat plugin to publish & verify decryption results on-chain, and add end-to-end integration tests.

## 0.2.1

### Patch Changes

- ac47e2f: Add `PermitUtils.checkValidityOnChain` to validate permits against the on-chain deployed ACL (source of truth).
- 0000d5e: Mock contracts deployed to alternate fixed addresses to avoid collision with hardhat pre-compiles.

## 0.2.0

### Minor Changes

- 8fda09a: Removes `Promise<boolean>` return type from `client.connect(...)`, instead throws an error if the connection fails.
- e0caeca: Adds `environment: 'node' | 'web' | 'hardhat' | 'react'` option to config. Exposed via `client.config.enviroment`. Automatically populated appropriately within the various `createCofhesdkConfig` functions.

### Patch Changes

- e121108: Fix ACL permission invalid issue. MockACL needs real deployment since etching doesn't call the constructor, so the EIP712 is uninitialized. Also adds additional utility functions to hardhat-plugin:

  - `hre.cofhesdk.connectWithHardhatSigner(client, signer)` - Connect to client with hardhat ethers signer.
  - `hre.cofhesdk.createBatteriesIncludedCofhesdkClient()` - Creates a batteries included client with signer connected.
  - `hre.cofhesdk.mocks.getMockTaskManager()` - Gets deployed Mock Taskmanager
  - `hre.cofhesdk.mocks.getMockACL()` - Gets deployed Mock ACL

## 0.1.1

### Patch Changes

- a1d1323: Add repository info to package.json of public packages to fix npm publish provenance issue.
- d232d11: Ensure publish includes correct src and dist files
- b6521fb: Update publish workflow to create versioning PR upon merge with changeset.

## 0.1.0

### Minor Changes

- 8d41cf2: Combine existing packages into more reasonable defaults. New package layout is @cofhe/sdk (includes all the core logic for configuring and creating a @cofhe/sdk client, encrypting values, and decrypting handles), mock-contracts, hardhat-plugin, and react.
- a83facb: Prepare for initial release. Rename scope from `@cofhesdk` to `@cofhe` and rename `cofhesdk` package to `@cofhe/sdk`. Create `publish.yml` to publish `beta` packages on merged PR, and `latest` on changeset PR.
- 58e93a8: Migrate cofhe-mock-contracts and cofhe-hardhat-plugin into @cofhe/sdk.

This changelog is maintained by Changesets and will be populated on each release.

- Do not edit this file by hand.
- Upcoming changes can be previewed with `pnpm changeset status --verbose`.
- Entries are generated when the Changesets "Version Packages" PR is created/merged.
