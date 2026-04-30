# @cofhe/sdk Changelog

## 0.5.1

### Patch Changes

- 342fd0f: Fix SSR compatibility (`@cofhe/sdk/web` no longer crashes Next.js builds with `self is not defined`) by lazy-loading `tfhe`. Align `@cofhe/mock-contracts` with `@fhenixprotocol/cofhe-contracts@^0.1.3` (updated `TestBed.sol` to use current decrypt API, added missing `ITaskManager` batch methods to `MockTaskManager.sol`).

## 0.5.0

### Minor Changes

- 788a6e2: Add `onPoll` callback support for decrypt polling (tx + view) so consumers can observe poll progress.

  - SDK decrypt helpers accept `onPoll` and emit `{ operation, requestId, attemptIndex, elapsedMs, intervalMs, timeoutMs }` once per poll attempt.
  - React wiring supports passing the callback end-to-end.
  - Docs updated with usage examples.

- 9a06012: Tighten permit validation and treat invalid permits as missing.

  - SDK: `PermitUtils.validate` now enforces schema + signed + not-expired (use `PermitUtils.validateSchema` for schema-only validation).
  - SDK: `ValidationResult.error` is now a typed union (`'invalid-schema' | 'expired' | 'not-signed' | null`).
  - React: rename `disabledDueToMissingPermit` to `disabledDueToMissingValidPermit` in read/decrypt hooks and token balance helpers, and disable reads when the active permit is invalid.

### Patch Changes

- 6c4084f: Add submit retries to the threshold-network decrypt flows used by both `decryptForTx` and `decryptForView` when the backend responds with `204 No Content` before a `request_id` is available.

  - When the submit endpoint returns `204` without a body, the SDK now retries until it receives a `request_id` or the existing poll timeout budget is exhausted.
  - These submit retries now emit `onPoll` callbacks, so consumers can observe retry progress before a request id exists.
  - Submit retries and status polling now share the same overall timeout budget.

- 503536a: Improve logging ergonomics across React + web SDK.

  - Add a configurable internal logger to `@cofhe/react` via `createCofheConfig({ react: { logger } })`.
  - Make `@cofhe/sdk` `createWebStorage` logging opt-in via `createWebStorage({ enableLog })`.

- a685cd4: **Breaking change: upgraded to tfhe v1.5.3.**
  Previous cofhesdk versions will no longer function.

## 0.4.0

### Patch Changes

- e446642: Switch `decryptForTx` to Threshold Network v2 decrypt (submit + poll)

## 0.3.2

### Patch Changes

- d4e86ea: Aligns with CTA encrypted variables bytes32 representation.

  - **@cofhe/hardhat-plugin**: `hre.cofhe.mocks.getTestBed()`, `getMockTaskManager()`, `getMockACL()`, `getMockThresholdNetwork()`, and `getMockZkVerifier()` now return typed contracts (typechain interfaces) instead of untyped `Contract`. `getPlaintext(ctHash)` and `expectPlaintext(ctHash, value)` now accept bytes32 ctHashes as `string` support cofhe-contracts 0.1.0 CTA changes.
  - **@cofhe/mock-contracts**: Export typechain-generated contract types (`TestBed`, `MockACL`, `MockTaskManager`, `MockZkVerifier`, `MockThresholdNetwork`) for use with the hardhat plugin. Typechain is run from artifact ABIs only; factory files are not generated.
  - **@cofhe/abi**: CTA-related types use `bytes32` (string) instead of `uint256`. Decryption and return-type helpers aligned with cofhe-contracts 0.1.0.
  - **@cofhe/sdk**: Decryption APIs (`decryptForTx`, `decryptForView`, and related builders) now also accept `string` for ciphertext hashes (bytes32) as well as `bigint`.

- 0feaf3f: `cofheClient.decryptForTx` returns a ready-to-use signature

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

- 650ea48: Align builder patterns in cofhe client api (`client.encryptInputs(..).encrypt()` and `client.decryptHandles(..).decrypt()`) to use the same terminator function `.execute()` instead of `.encrypt()`/`.decrypt()`.

  Rename `setStepCallback` of encryptInputs builder to `onStep` to improve ergonomics.

### Patch Changes

- 5467d77: Adds `config.mocks.encryptDelay: number | [number, number, number, number, number]` to allow configurable mock encryption delay. Defaults to 0 delay on hardhat to keep tests quick.
- 73b1502: Add `cofheClient.connection` getter which exposes inner connection state without using `getSnapshot()` reactive utility.

## 0.2.1

### Patch Changes

- 409bfdf: Add `hash` field to permits, calculated at permit creation time. Replaces `PermitUtils.getHash(permit)` with `permit.hash`.
- ac47e2f: Add `PermitUtils.checkValidityOnChain` to validate permits against the on-chain deployed ACL (source of truth).
- 8af1b70: Updated to Zod 4 for improved performance and type safety. Includes internal changes to validation schemas and error handling that should not affect external API usage.

## 0.2.0

### Minor Changes

- 8fda09a: Removes `Promise<boolean>` return type from `client.connect(...)`, instead throws an error if the connection fails.
- e0caeca: Adds `environment: 'node' | 'web' | 'hardhat' | 'react'` option to config. Exposed via `client.config.enviroment`. Automatically populated appropriately within the various `createCofhesdkConfig` functions.
- 2a9d6c5: Updated to new CoFHE /sealoutputV2 endpoint - uses polling to fetch decryption results instead of long running open HTTP connections.

### Patch Changes

- 4057a76: Add WebWorker for zkProve
- dba2759: Add getOrCreate permit functions
- 7c861af: Remove `initializationResults` from cofhesdk client.

## 0.1.1

### Patch Changes

- a1d1323: Add repository info to package.json of public packages to fix npm publish provenance issue.
- d232d11: Ensure publish includes correct src and dist files
- b6521fb: Update publish workflow to create versioning PR upon merge with changeset.

## 0.1.0

### Minor Changes

- 87fc8a0: Initial extraction from cofhejs. Split permit `create` into type specific creators: `createSelf`, `createShared`, and `importShared`
- 8d41cf2: Combine existing packages into more reasonable defaults. New package layout is @cofhe/sdk (includes all the core logic for configuring and creating a @cofhe/sdk client, encrypting values, and decrypting handles), mock-contracts, hardhat-plugin, and react.
- 738b9f5: Adding adapters for ethers5/6, Wagmi and HardHat
- a83facb: Prepare for initial release. Rename scope from `@cofhesdk` to `@cofhe` and rename `cofhesdk` package to `@cofhe/sdk`. Create `publish.yml` to publish `beta` packages on merged PR, and `latest` on changeset PR.
- 9a7c98e: Create core store, split initialize into `create` and `connect`, and port `encryptInputs` with improvements.
- 58e93a8: Migrate cofhe-mock-contracts and cofhe-hardhat-plugin into @cofhe/sdk.
- fdf26d4: Move storage handling to web/node targets; add `fheKeysStorage` config with environment-specific defaults.
- f5b8e25: Add @cofhe/sdk config type and parsing.
- 3b135a8: Create @cofhe/sdk/node and @cofhe/sdk/web

  Additional changes:

  - Fhe keys aren't fetched until `client.encryptInputs(...).encrypt()`, they aren't used anywhere else other than encrypting inputs, so their fetching is deferred until then.
  - Initializing the tfhe wasm is also deferred until `client.encryptInputs(...).encrypt()` is called (allows for deferred async initialization)

- 5b7c43b: Create @cofhe/sdk client, hook in permits.
  Create encryptInputs functionality. (+ mocks)
  Create decryptHandles functionality. (+ mocks)
  Improve @cofhe/sdk errors and error handling.

  fix - seal_output include error_message in failing Error.

### Patch Changes

- cba73fd: Add duration and context information to the step callback function for encryptInputs. Split fetch keys step into InitTfhe and FetchKeys.
  InitTfhe context includes a `tfheInitializationExecuted` indicating if tfhe was initialized (true) or already initialized (false).
  FetchKeys returns flags for whether the fhe and crs keys were fetch from remote (true) or from cache (false).
- 4bc8182: Add storage and key store

This changelog is maintained by Changesets and will be populated on each release.

- Do not edit this file by hand.
- Upcoming changes can be previewed with `pnpm changeset status --verbose`.
- Entries are generated when the Changesets "Version Packages" PR is created/merged.
