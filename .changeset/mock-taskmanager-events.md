---
'@cofhe/mock-contracts': patch
---

`MockTaskManager` emits the TaskManager's `InputVerified`, `SecurityZonesChanged`, `VerifierSignerChanged`, `DecryptResultSignerChanged` and `ACLContractChanged` events, and its `TaskCreated` event for `cast` carries the target type as `input2`. Previously none of these events were emitted and `cast` reported `input2` as 0.
