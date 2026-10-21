---
'@cofhe/mock-contracts': minor
'@cofhe/foundry-plugin': patch
'@cofhe/hardhat-plugin': patch
'@cofhe/hardhat-3-plugin': patch
---

The mocks take `ACPShareRegistry`, `ACPTimestampRevoker` and `Permissioned` from `@fhenixprotocol/cofhe-contracts` 1.0.2 instead of carrying verbatim copies; the `update:cofhe-contracts` script and its manifest are gone. The old `@cofhe/mock-contracts/contracts/<name>.sol` import paths keep working and forward to `@fhenixprotocol/cofhe-contracts/internal/host-chain/contracts/<name>.sol`.

`MockTaskManager` implements the `addToAccessList` / `removeFromAccessList` that cofhe-contracts 1.0.2 adds to `ITaskManager` as stubs: they record the accounts in `accessList` and gate nothing.

Both Hardhat plugins now require `@fhenixprotocol/cofhe-contracts` >= 1.0.2 in the project (the mocks import its ACP contracts); the Hardhat 3 plugin compiles `ACPTimestampRevoker` and `ACPShareRegistry` from that package as roots.
