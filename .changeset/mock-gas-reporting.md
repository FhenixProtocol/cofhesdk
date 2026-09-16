---
'@cofhe/mock-contracts': minor
'@cofhe/foundry-plugin': minor
'@cofhe/hardhat-plugin': minor
'@cofhe/hardhat-3-plugin': minor
---

Realistic gas reporting for mocks. Under Foundry, `CofheTest.deployMocks()` now excludes mock-only work (FHE op replication, decrypt-task storage, logging) from gas metering by default, so reported gas approximates real-network cost — expect existing `forge snapshot` numbers to drop; opt out with `mockTaskManager.setMockGasExcluded(false)` (forge ≥ 1.0 recommended). A gas-metering pause owned by your own test is detected and left untouched. The mocks are also cheaper outright (enum op dispatch, log strings only built when logging is enabled). On Hardhat, the mock task manager emits a `MockGasConsumed(uint256)` event per block of mock-only work — note that FHE transaction receipts therefore carry additional logs, so tests using positional log access (`receipt.logs[i]`, `logs.length`) may need updating. Both hardhat plugins expose `getAdjustedGasUsed(receipt)` / `getAdjustedGasBreakdown(receipt)` (on `hre.cofhe` / `conn.cofhe`) and an opt-in `cofhe.gasSummary` config that prints a per-method raw-vs-adjusted table after `hardhat test` (reconstructed from chain history: snapshot-reverted transactions won't appear). `eth_estimateGas` remains unadjusted.
