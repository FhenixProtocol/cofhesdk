# @cofhe/hardhat-plugin Changelog

## 0.4.0

### Patch Changes

- Updated dependencies [e446642]
  - @cofhe/sdk@0.4.0
  - @cofhe/mock-contracts@0.4.0

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
  - @cofhe/mock-contracts@0.3.2

## 0.3.1

### Patch Changes

- 370f0c7: no-op
- Updated dependencies [370f0c7]
  - @cofhe/mock-contracts@0.3.1
  - @cofhe/sdk@0.3.1

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

### Patch Changes

- 5467d77: Adds `config.mocks.encryptDelay: number | [number, number, number, number, number]` to allow configurable mock encryption delay. Defaults to 0 delay on hardhat to keep tests quick.
- Updated dependencies [35024b6]
- Updated dependencies [5467d77]
- Updated dependencies [73b1502]
- Updated dependencies [29c2401]
- Updated dependencies [650ea48]
  - @cofhe/mock-contracts@0.3.0
  - @cofhe/sdk@0.3.0

## 0.2.1

### Patch Changes

- 0000d5e: Mock contracts deployed to alternate fixed addresses to avoid collision with hardhat pre-compiles.
- Updated dependencies [409bfdf]
- Updated dependencies [ac47e2f]
- Updated dependencies [0000d5e]
- Updated dependencies [8af1b70]
  - @cofhe/sdk@0.2.1
  - @cofhe/mock-contracts@0.2.1

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

- Updated dependencies [8fda09a]
- Updated dependencies [e121108]
- Updated dependencies [4057a76]
- Updated dependencies [dba2759]
- Updated dependencies [e0caeca]
- Updated dependencies [7c861af]
- Updated dependencies [2a9d6c5]
  - @cofhe/mock-contracts@0.2.0
  - @cofhe/sdk@0.2.0

## 0.1.1

### Patch Changes

- a1d1323: Add repository info to package.json of public packages to fix npm publish provenance issue.
- d232d11: Ensure publish includes correct src and dist files
- b6521fb: Update publish workflow to create versioning PR upon merge with changeset.
- Updated dependencies [a1d1323]
- Updated dependencies [d232d11]
- Updated dependencies [b6521fb]
  - @cofhe/mock-contracts@0.1.1
  - @cofhe/sdk@0.1.1

## 0.1.0

### Minor Changes

- 8d41cf2: Combine existing packages into more reasonable defaults. New package layout is @cofhe/sdk (includes all the core logic for configuring and creating a @cofhe/sdk client, encrypting values, and decrypting handles), mock-contracts, hardhat-plugin, and react.
- a83facb: Prepare for initial release. Rename scope from `@cofhesdk` to `@cofhe` and rename `cofhesdk` package to `@cofhe/sdk`. Create `publish.yml` to publish `beta` packages on merged PR, and `latest` on changeset PR.
- 58e93a8: Migrate cofhe-mock-contracts and cofhe-hardhat-plugin into @cofhe/sdk.

### Patch Changes

- Updated dependencies [cba73fd]
- Updated dependencies [87fc8a0]
- Updated dependencies [8d41cf2]
- Updated dependencies [738b9f5]
- Updated dependencies [a83facb]
- Updated dependencies [9a7c98e]
- Updated dependencies [58e93a8]
- Updated dependencies [fdf26d4]
- Updated dependencies [f5b8e25]
- Updated dependencies [3b135a8]
- Updated dependencies [5b7c43b]
- Updated dependencies [4bc8182]
  - @cofhe/sdk@0.1.0
  - @cofhe/mock-contracts@0.1.0

This changelog is maintained by Changesets and will be populated on each release.

- Do not edit this file by hand.
- Upcoming changes can be previewed with `pnpm changeset status --verbose`.
- Entries are generated when the Changesets "Version Packages" PR is created/merged.
