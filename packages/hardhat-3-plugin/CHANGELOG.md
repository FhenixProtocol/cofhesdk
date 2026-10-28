# @cofhe/hardhat-3-plugin

## 1.0.1

### Patch Changes

- Updated dependencies [fcc819c]
  - @cofhe/sdk@1.0.1
  - @cofhe/mock-contracts@1.0.1

## 1.0.0

### Minor Changes

- 6dcfb7d: ACPs sharing SNAPSHOTs (ctHashes rather than live data) can use the new on-chain ACP Sharing Registry `metadata` field to cite the origin of the snapshotted data (contract address + view-function / event), and the recipient can verify it on-chain. [Docs](https://cofhesdk.fhenix.io/sdk/acp#labelling-a-snapshot-share)

  **@cofhe/sdk**

  - `createSharing({ labels })`, `shareOnChain(acp, { labels | metadata })`; labels travel in `export()` / `importShared` as `SharedACP.metadata`.
  - New `client.acp.verifyShareLabels`, `client.acp.getShareFromChain`, and `describeShareMetadata`. `IncomingShare` gains `metadata` and `appKey`.
  - New `acp.app` config option: shares are tagged with the app's key and `getIncomingShares` lists only that app's shares ([docs](https://cofhesdk.fhenix.io/sdk/acp#mark-shares-for-your-app)).
  - `@cofhe/sdk/acps` exports the metadata codec, label builders (`viewFunctionLabel`, `eventLogLabel`, `UNLABELLED`), verifiers, registry readers, `shareAppKey` and `ERC7984_ABI`.

  **@cofhe/react**

  - New `useCofheShareLabels`. `useCofheShareOnChain` accepts `{ acp, labels | metadata }`.
  - The inbox shows each share's labels and their verification. [Docs](https://cofhesdk.fhenix.io/react/acp#share-labels)

  **Mocks and plugins**

  - `ACPShareRegistry`, `ACPTimestampRevoker` and `Permissioned` are copied verbatim from a pinned cofhe-contracts commit (`pnpm update:cofhe-contracts <commit>`). The share registry is deployed behind `MockERC1967Proxy`.
  - Mocks now need Solidity ≥0.8.25 and `@openzeppelin/contracts-upgradeable` (new Hardhat plugin peer dependency; Foundry users add its remapping).

### Patch Changes

- 715b220: `cofhe.logMocks: true` now turns on FHE operation logs when the mocks are deployed. It was previously ignored.
- Updated dependencies [d711ce2]
- Updated dependencies [d711ce2]
- Updated dependencies [5a192ee]
- Updated dependencies [757e448]
- Updated dependencies [73d5297]
- Updated dependencies [6dcfb7d]
- Updated dependencies [8fad647]
- Updated dependencies [a4fcea7]
  - @cofhe/mock-contracts@1.0.0
  - @cofhe/sdk@1.0.0

## 0.8.0

### Minor Changes

- 6f7a4c5: Resolve the Task Manager through the `CoFHEAddressBook` (`@fhenixprotocol/cofhe-contracts@1.0.0`). **Breaking:** `TASK_MANAGER_ADDRESS` is removed from `@cofhe/sdk`. Use `getTaskManagerAddress(publicClient)`, which reads `getTm(TASK_MANAGER_ID)` from the book at `COFHE_ADDRESS_BOOK_ADDRESS` (both exported) and caches the result per chain. If the chain has no book, or the id is unset, it throws `TASK_MANAGER_UNRESOLVED`. `verifyDecryptResult`, the ACL/ACP lookups and `useCofheEnabled` / `useCofheReadDecryptionResults` now resolve the Task Manager this way. `@cofhe/react` adds `useCofheTaskManagerAddress()`.

  Mocks: a new `MockCoFHEAddressBook` is deployed at FHE.sol's `COFHE_ADDRESS_BOOK`, and `MockTaskManager` moves to `MOCKS_TASK_MANAGER_ADDRESS` (`0x…5000`) and is registered in the book. `MockACL` now stores its Task Manager (`setTaskManager` / `getTaskManagerAddress`) instead of reading a constant, so its `TASK_MANAGER_ADDRESS_()` getter is gone. All three plugins deploy and wire the book. Hardhat 2 exposes `hre.cofhe.mocks.getMockCoFHEAddressBook()`, Hardhat 3 exposes `conn.cofhe.mocks.MockCoFHEAddressBook`, and Foundry exposes `CofheTest.mockAddressBook`. Contracts must be built against `@fhenixprotocol/cofhe-contracts@1.0.0` or later (the hardhat plugin's peer range is now `>=1.0.0`). Each FHE op now makes one extra `getTm` call on the book, as it does on real networks, so expect slightly higher gas numbers.

### Patch Changes

- ccb7b68: Realistic gas reporting for mocks. Under Foundry, mock-only work is now excluded from gas metering by default (opt out with `mockTaskManager.setMockGasExcluded(false)`), so expect `forge snapshot` numbers to drop. Under Hardhat, mock transactions emit `MockGasConsumed` events (extra receipt logs), and the plugins add `getAdjustedGasUsed(receipt)` / `getAdjustedGasBreakdown(receipt)` plus an opt-in `cofhe.gasSummary` report.
- Updated dependencies [17ff23e]
- Updated dependencies [0fe40c3]
- Updated dependencies [6f7a4c5]
- Updated dependencies [552d118]
- Updated dependencies [22eebcc]
- Updated dependencies [ccb7b68]
- Updated dependencies [42fccae]
  - @cofhe/sdk@0.8.0
  - @cofhe/mock-contracts@0.8.0

## 0.7.1

### Patch Changes

- Updated dependencies [e907d8c]
  - @cofhe/mock-contracts@0.7.1
  - @cofhe/sdk@0.7.1

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
