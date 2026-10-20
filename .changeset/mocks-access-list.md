---
'@cofhe/mock-contracts': patch
---

`MockTaskManager` implements `addToAccessList` and `removeFromAccessList`, which `ITaskManager` gained in `@fhenixprotocol/cofhe-contracts` 1.0.2. Previously, with cofhe-contracts 1.0.2 installed, compiling the mocks (the Hardhat plugin and Foundry tests compile them with your project) failed with `Contract "MockTaskManager" should be marked as abstract`. The mock records the list and emits `AccessGranted` / `AccessRevoked`. It does not model `ACCESS_LIST_MANAGER_ROLE` or enforce the list.
