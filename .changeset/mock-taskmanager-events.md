---
'@cofhe/mock-contracts': patch
---

Corrects `MockTaskManager` to emit the TaskManager's `InputVerified`, `SecurityZonesChanged`, `VerifierSignerChanged`, `DecryptResultSignerChanged` and `ACLContractChanged` events, and to report the target type as `input2` of `TaskCreated` for `cast`. Previously none of these events were emitted and `cast` reported `input2` as `0`.
