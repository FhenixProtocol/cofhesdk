---
'@cofhe/mock-contracts': minor
---

Add mock support for `sharedEuintXX` — contract-to-contract encrypted value movement, shipped in `@fhenixprotocol/cofhe-contracts@0.2.0-beta.3`.

`MockACL` gains `shareCtHash(handle, sharer, receiver)` and `receiveCtHash(handle, expectedSharer, receiver)`, backed by a directed, single-use, transaction-scoped share slot (domain-separated from transient allowance keys), plus the `NotShared` and `UnexpectedSharer` errors. `MockTaskManager` gains the matching `shareCtHash`/`receiveCtHash` passthroughs with `MOCK_logAllow` hooks.

`MockACL`'s transient allowances now use real EIP-1153 transient storage instead of approximating it with `block.number`, and `cleanTransientStorage()` is implemented rather than a no-op. This makes the mock faithful to the production ACL: **a transient allowance now expires at the end of its own transaction, not at the end of the block.** Tests that granted a transient allowance in one transaction and relied on it in a later transaction of the same block must be updated.

The repo also drops the temporary `pnpm patch` that carried these `FHE.sol` / `ICofhe.sol` additions, and pins `@fhenixprotocol/cofhe-contracts@0.2.0-beta.3`.
