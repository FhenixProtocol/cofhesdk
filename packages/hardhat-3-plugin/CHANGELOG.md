# @cofhe/hardhat-3-plugin

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
