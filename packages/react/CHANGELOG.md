# @cofhe/react

## 0.7.0

### Minor Changes

- fb87d91: **Breaking: Permit (V2) → ACP (Access Control Permission).** Permits become scoped, revocable ACPs; old names are removed rather than deprecated. Highlights (full list in the [0.7.0 migration guide](https://cofhesdk.fhenix.io/migrating-to-0-7-0)):

  - `Permit`/`Permission`/`PermitUtils`/`client.permits` → `ACP`/`ACPPublic`/`ACPUtils`/`client.acp`; `getPermission()` → `getPublic()`
  - `ACPPrivate` & `ACPPublic` are top-level types, `ACP` is the union; the sealing keypair is flattened to `sealingPrivateKey`/`sealingKey` (the `SealingKey` class is removed)
  - New scope fields (`scope`, `contracts`, `handles: bytes32[]`) and revocation fields renamed `validatorId`/`validatorContract` → `revokerData`/`revokerContract`; default revoker `ACPTimestampRevoker` with `revokeACP`/`revokeAllACPs`/`isACPRevoked` on the client
  - EIP-712 domain bumped to `("ACL", "2")` with new `ACPIssuerSelf`/`ACPIssuerShared`/`ACPRecipient` types — previously signed permits no longer verify; the permit store migrates by wiping retired-format permits
  - `ACPUtils.export()` produces a fixed `SharedACP` shape and only accepts signed sharing ACPs

- fb87d91: Migrate `cofheClient.encryptInputs` from one-signature-per-ciphertext to the new batch verification scheme (one signature per batch, per `FhenixProtocol/cofhe-contracts#78`).

  **Breaking:** `EncryptInputsBuilder.execute()` now always returns `[...hashes, signature]` (`HashPlusProofResult<T>`) instead of an array of per-item `EncryptedItemInput` structs. `EncryptedItemInput` and its per-type aliases (`EncryptedBoolInput`, `EncryptedUint8Input`, etc.) are removed, along with `EncryptInputsBuilder.asHashPlusProof()` (no longer needed - it's the only shape now). `@cofhe/abi`'s `extractEncryptableValues`/`insertEncryptedValues` now detect `external*` ABI types instead of `struct InEuintXX`, with a new calling convention: any function with encrypted inputs must end with a plain `bytes` parameter to receive the shared batch signature. `@cofhe/foundry-plugin`'s `CofheClient.createIn*` helpers are renamed to `createExternal*` (`createInEuint32` → `createExternalEuint32`, etc.) and now return an `external*` handle plus a batch signature rather than an `InEuintXX` struct; the `createIn*_asHashPlusProof` variants are removed as redundant. See the [0.7.0 migration guide](https://cofhesdk.fhenix.io/migrating-to-0-7-0) for the full list of changes and what contract authors need to update.

- fb87d91: Bind encrypted inputs to a consuming contract (`FhenixProtocol/cofhe-contracts#77`). The verifier-signed digest now includes the contract that will consume the ciphertext, closing a replay path where a signed input packet observed on-chain could be reused against a different contract than the one it was signed for.

  **Breaking:** `EncryptInputsBuilder.setConsumingContract(address)` must be called before `.execute()` - it throws `ConsumingContractUninitialized` otherwise. `@cofhe/mock-contracts`'s `MockTaskManager` signature digest changed to include the consuming contract (external ABI unchanged). `@cofhe/foundry-plugin`'s `CofheClient.createExternal*`/`createEuint32sBatch` helpers now take a required `address consumingContract` as their last parameter (no global setter). `@cofhe/react`'s `useCofheEncryptAndWriteContract` defaults `consumingContract` to the write's target address automatically; `useCofheEncrypt` accepts it as an explicit option. See the [0.7.0 migration guide](https://cofhesdk.fhenix.io/migrating-to-0-7-0) for full details.

- 24edf0c: feat(react): useKnownCofheToken; useCofheToken no longer probes on-chain

  New `useKnownCofheToken({ chainId, address })`: resolves a token address against what the
  client already knows — configured tokenlists, imported (custom) tokens, and the chain's
  default token. Never touches the chain; unknown resolves to `undefined`.

  `useCofheToken` no longer falls back to `useResolvedCofheToken`'s on-chain interface probe
  for unlisted addresses. The silent fallback was incorrect: it also fired for known tokens
  during the tokenlist-loading window and probed the connected chain regardless of the
  requested `chainId`, producing spurious "Address is not a supported CoFHE token" failures
  for stale or wrong-chain addresses. It now delegates to `useKnownCofheToken` (its options
  parameter is deprecated and unused). Consumers that genuinely want on-chain resolution
  must call `useResolvedCofheToken` explicitly.

- fb87d91: **Permit is now ACP everywhere.** All Permit-named API surface is renamed to ACP to avoid confusion with classic DeFi permits: types (`SelfACP`, `SharingACP`, `RecipientACP`, ...), client methods (`getOrCreateSelfACP`, `withACP`, ...), react hooks and components (`useCofheACPs`, `ACPCard`, ...), error codes (`ACP_DENIED`, ...), the `@cofhe/sdk/permits` entrypoint (now `@cofhe/sdk/acps`), and all documentation. English prose words (permitted/permitting) and protocol contract interfaces are unchanged. The persisted store key also changed; previously stored ACPs are not migrated and are transparently re-created on next use.
- fb87d91: Support confidential tokens whose public (underlying) and confidential sides use different decimals (e.g. 18 vs 6): new `getPublicDecimals`/`getConfidentialDecimals`/`getPublicSymbol` accessors and `scaleAmount`/`quantizeAmount` helpers; transaction store entries now record the denomination of their amounts; shield inputs are quantized to the precision the contract actually mints; unshield amounts are guarded against the confidential value type's range.

### Patch Changes

- 2862a63: fix(react): persist only successful query states

  The persistence filter checked only the `meta.persist` opt-in, without react-query's default status check, so a query was dehydrated in whatever state it was in — including `error`. A restored errored query never refetches (persisted queries default to `staleTime: Infinity` / `refetchOnMount: false`), leaving the consumer stuck with a permanent failed state that survives reloads and emits no error event on hydration.

  Only successful states are persisted now. Once a query errors, its entry (including any previously persisted success) is dropped from the snapshot, so the next load starts clean and fetches live.

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
  - @cofhe/abi@0.7.0

## 0.6.1

### Patch Changes

- Updated dependencies [670cda8]
  - @cofhe/sdk@0.6.1
  - @cofhe/abi@0.6.1

## 0.6.0

### Patch Changes

- bf23270: Upgrade `zustand` to 5.0.13 to pick up the upstream persist storage fix used by the SDK and React package.
- Updated dependencies [bf23270]
- Updated dependencies [2711f9b]
- Updated dependencies [566f126]
  - @cofhe/sdk@0.6.0
  - @cofhe/abi@0.6.0

## 0.5.2

### Patch Changes

- Updated dependencies [2fbb918]
  - @cofhe/sdk@0.5.2
  - @cofhe/abi@0.5.2

## 0.5.1

### Patch Changes

- Updated dependencies [342fd0f]
  - @cofhe/sdk@0.5.1
  - @cofhe/abi@0.5.1

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
