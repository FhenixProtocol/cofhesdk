---
'@cofhe/mock-contracts': patch
---

`MockTaskManager.publishDecryptResultBatch` now emits `DecryptionResult` with the caller as the `requestor`, like the TaskManager. Previously each result went through an external call to the mock itself, so the requestor was the task manager's own address. `publishDecryptResultBatch`, `verifyDecryptResultBatch` and `verifyDecryptResultBatchSafe` now revert with `LengthMismatch` when the arrays differ in length, instead of panicking or ignoring the extra entries.
