# @cofhe/mock-contracts Changelog

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
