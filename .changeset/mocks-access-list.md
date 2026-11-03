---
'@cofhe/mock-contracts': patch
---

Corrects `MockTaskManager` to implement `addToAccessList` and `removeFromAccessList`, added to `ITaskManager` in `@fhenixprotocol/cofhe-contracts` 1.0.2. Previously, with cofhe-contracts 1.0.2 installed, the mocks failed to compile with `Contract "MockTaskManager" should be marked as abstract`.
