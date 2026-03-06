# @cofhe/react

## 0.3.1

### Patch Changes

- 370f0c7: no-op
- Updated dependencies [370f0c7]
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

- 650ea48: Align builder patterns in cofhe client api (`client.encryptInputs(..).encrypt()` and `client.decryptHandles(..).decrypt()`) to use the same terminator function `.execute()` instead of `.encrypt()`/`.decrypt()`.

  Rename `setStepCallback` of encryptInputs builder to `onStep` to improve ergonomics.

### Patch Changes

- Updated dependencies [35024b6]
- Updated dependencies [5467d77]
- Updated dependencies [73b1502]
- Updated dependencies [29c2401]
- Updated dependencies [650ea48]
  - @cofhe/sdk@0.3.0

## 0.2.1

### Patch Changes

- 409bfdf: Add `hash` field to permits, calculated at permit creation time. Replaces `PermitUtils.getHash(permit)` with `permit.hash`.
- Updated dependencies [409bfdf]
- Updated dependencies [ac47e2f]
- Updated dependencies [8af1b70]
  - @cofhe/sdk@0.2.1

## 0.2.0

### Minor Changes

- 8fda09a: Removes `Promise<boolean>` return type from `client.connect(...)`, instead throws an error if the connection fails.
- 4057a76: Add react components and hooks
- e0caeca: Adds `environment: 'node' | 'web' | 'hardhat' | 'react'` option to config. Exposed via `client.config.enviroment`. Automatically populated appropriately within the various `createCofhesdkConfig` functions.

### Patch Changes

- 7f84f1c: Add react package
- Updated dependencies [8fda09a]
- Updated dependencies [4057a76]
- Updated dependencies [dba2759]
- Updated dependencies [e0caeca]
- Updated dependencies [7c861af]
- Updated dependencies [2a9d6c5]
  - @cofhe/sdk@0.2.0

## 0.1.0

### Minor Changes

- a83facb: Prepare for initial release. Rename scope from `@cofhesdk` to `@cofhe` and rename `cofhesdk` package to `@cofhe/sdk`. Create `publish.yml` to publish `beta` packages on merged PR, and `latest` on changeset PR.
