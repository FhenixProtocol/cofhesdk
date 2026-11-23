---
'@cofhe/mock-contracts': patch
---

Corrects `MockTaskManager.createTask` to revert with `InvalidOperationInputs` when an operation other than trivial encrypt or cast is given extra inputs, as the TaskManager does. Previously `add` with one extra input reverted with the mock-only `InvalidThreeInputOperation("add")`.
