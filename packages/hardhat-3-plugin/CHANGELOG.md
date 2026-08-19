# @cofhe/hardhat-3-plugin

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

### Patch Changes

- Updated dependencies [fb87d91]
- Updated dependencies [fb87d91]
- Updated dependencies [fb87d91]
- Updated dependencies [fb87d91]
- Updated dependencies [fb87d91]
- Updated dependencies [d4d662f]
- Updated dependencies [fb87d91]
- Updated dependencies [fb87d91]
- Updated dependencies [f01cac7]
  - @cofhe/sdk@0.7.0
  - @cofhe/mock-contracts@0.7.0

## 0.6.1

### Patch Changes

- Updated dependencies [670cda8]
  - @cofhe/sdk@0.6.1
  - @cofhe/mock-contracts@0.6.1

## 0.6.0

### Minor Changes

- 566f126: Remove the legacy `TestBed` mock surface and stop auto-deploying `SimpleTest` through the Hardhat plugins. Core mock contracts still deploy automatically, while tests that need `SimpleTest` should deploy it explicitly from their own artifacts.

  This also removes `TEST_BED_ADDRESS` and cleans up duplicate `SimpleTest` exports from `@cofhe/mock-contracts`.

### Patch Changes

- Updated dependencies [bf23270]
- Updated dependencies [2711f9b]
- Updated dependencies [566f126]
  - @cofhe/sdk@0.6.0
  - @cofhe/mock-contracts@0.6.0

## 0.5.2

### Patch Changes

- Updated dependencies [2fbb918]
  - @cofhe/sdk@0.5.2
  - @cofhe/mock-contracts@0.5.2

## 0.5.1

### Patch Changes

- Updated dependencies [342fd0f]
  - @cofhe/sdk@0.5.1
  - @cofhe/mock-contracts@0.5.1

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
- Updated dependencies [6c4084f]
- Updated dependencies [50bb3e4]
- Updated dependencies [788a6e2]
- Updated dependencies [9a06012]
- Updated dependencies [503536a]
- Updated dependencies [a685cd4]
  - @cofhe/sdk@0.5.0
  - @cofhe/mock-contracts@0.5.0
