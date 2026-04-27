# @cofhe/react

## 0.5.0

### Minor Changes

- 7b1f4c3: Add custom token import support to the React widget token picker.

  - Let users import CoFHE tokens by contract address directly from the token list and portfolio flows.
  - Persist imported tokens per chain in local storage and merge them into `useCofheTokens()` results.
  - Resolve token metadata and CoFHE compatibility on demand before importing, including wrapped-token pair metadata when available.

- 788a6e2: Add `onPoll` callback support for decrypt polling (tx + view) so consumers can observe poll progress.

  - SDK decrypt helpers accept `onPoll` and emit `{ operation, requestId, attemptIndex, elapsedMs, intervalMs, timeoutMs }` once per poll attempt.
  - React wiring supports passing the callback end-to-end.
  - Docs updated with usage examples.

- 9a06012: Tighten permit validation and treat invalid permits as missing.

  - SDK: `PermitUtils.validate` now enforces schema + signed + not-expired (use `PermitUtils.validateSchema` for schema-only validation).
  - SDK: `ValidationResult.error` is now a typed union (`'invalid-schema' | 'expired' | 'not-signed' | null`).
  - React: rename `disabledDueToMissingPermit` to `disabledDueToMissingValidPermit` in read/decrypt hooks and token balance helpers, and disable reads when the active permit is invalid.

- f857263: When no wallet is connected, the portal now hides the wallet header and navigation and shows a message asking the user to connect.

  Add `react.projectName` so apps can include their name in that message.

- 09bf7c9: Add the `useCofheEnabled` hook to read `TaskManager.isEnabled()` from the connected chain.

### Patch Changes

- 503536a: Improve logging ergonomics across React + web SDK.

  - Add a configurable internal logger to `@cofhe/react` via `createCofheConfig({ react: { logger } })`.
  - Make `@cofhe/sdk` `createWebStorage` logging opt-in via `createWebStorage({ enableLog })`.

- 90a0d02: Remove the MUI icon peer dependency requirement from `@cofhe/react` by bundling the package's internal icons.

  Consumers can now install `@cofhe/react` without adding `@mui/icons-material` or `@mui/material` just to use the built-in UI components.

- a685cd4: **Breaking change: upgraded to tfhe v1.5.3.**
  Previous cofhesdk versions will no longer function.
- Updated dependencies [6c4084f]
- Updated dependencies [788a6e2]
- Updated dependencies [9a06012]
- Updated dependencies [503536a]
- Updated dependencies [a685cd4]
  - @cofhe/sdk@0.5.0
  - @cofhe/abi@0.5.0

## 0.4.0

### Patch Changes

- Updated dependencies [e446642]
  - @cofhe/sdk@0.4.0

## 0.3.2

### Patch Changes

- Updated dependencies [d4e86ea]
- Updated dependencies [0feaf3f]
  - @cofhe/sdk@0.3.2

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
