---
'@cofhe/mock-contracts': minor
'@cofhe/foundry-plugin': patch
'@cofhe/hardhat-plugin': patch
'@cofhe/hardhat-3-plugin': patch
---

The mocks take `ACPShareRegistry`, `ACPTimestampRevoker` and `Permissioned` from `@fhenixprotocol/cofhe-contracts` 1.0.2 instead of carrying verbatim copies; the `update:cofhe-contracts` script and its manifest are gone. The old `@cofhe/mock-contracts/contracts/<name>.sol` import paths keep working and forward to `@fhenixprotocol/cofhe-contracts/internal/host-chain/contracts/<name>.sol`.

`MockTaskManager` gains the access list that cofhe-contracts 1.0.2 adds to `ITaskManager`: `enableAccessList`, `disableAccessList`, `addToAccessList` and `removeFromAccessList`, callable by the owner or an account named in `MOCK_setAccessListManager`, and gating `createTask`, `createRandomTask` and `batchVerifyInputs` while enabled. It is off by default, so existing tests are unaffected; a contract made a manager can use `FHE.addToAccessList` / `FHE.removeFromAccessList`.

Both Hardhat plugins now require `@fhenixprotocol/cofhe-contracts` >= 1.0.2 in the project (the mocks import its ACP contracts); the Hardhat 3 plugin compiles `ACPTimestampRevoker` and `ACPShareRegistry` from that package as roots.
