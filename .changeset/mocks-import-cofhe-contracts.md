---
'@cofhe/mock-contracts': minor
'@cofhe/foundry-plugin': patch
'@cofhe/hardhat-plugin': patch
'@cofhe/hardhat-3-plugin': patch
---

**@cofhe/mock-contracts**

Changes the mocks to import `Permissioned`, `ACPShareRegistry` and `ACPTimestampRevoker` from `@fhenixprotocol/cofhe-contracts` instead of bundling copies, so they can no longer drift from the real contracts. The `@cofhe/mock-contracts/contracts/<name>.sol` paths still resolve. Requires `@fhenixprotocol/cofhe-contracts` 1.0.2 or later, the first release that publishes those files.

**@cofhe/hardhat-plugin**, **@cofhe/hardhat-3-plugin**

Changes the required `@fhenixprotocol/cofhe-contracts` in your project to 1.0.2 or later. The Hardhat 3 plugin compiles `ACPTimestampRevoker` and `ACPShareRegistry` from that package as root files so their artifacts are available to the mock deploy.

**@cofhe/foundry-plugin**

Changes `CofheClient` and `CofheTest` to import the ACP contracts from `@fhenixprotocol/cofhe-contracts`, which the existing `@fhenixprotocol/cofhe-contracts/` remapping already resolves.
