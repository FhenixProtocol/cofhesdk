# @cofhe/react

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
