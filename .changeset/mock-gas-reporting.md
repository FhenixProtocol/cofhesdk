---
'@cofhe/mock-contracts': patch
'@cofhe/foundry-plugin': patch
'@cofhe/hardhat-plugin': patch
'@cofhe/hardhat-3-plugin': patch
---

Realistic gas reporting for mocks. Under Foundry, `CofheTest.deployMocks()` now excludes mock-only work (FHE op replication, decrypt-task storage, logging) from gas metering by default, so reported gas approximates real-network cost — expect existing `forge snapshot` numbers to drop; opt out with `mockTaskManager.setMockGasExcluded(false)` (forge ≥ 1.0 recommended). The mocks are also cheaper outright (enum op dispatch, log strings only built when logging is enabled). On Hardhat, the mock task manager emits a `MockGasConsumed(uint256)` event per block of mock-only work; both hardhat plugins expose `getAdjustedGasUsed(receipt)` / `getAdjustedGasBreakdown(receipt)` (on `hre.cofhe` / `conn.cofhe`) and an opt-in `cofhe.gasSummary` config that prints a per-method raw-vs-adjusted table after `hardhat test`. `eth_estimateGas` remains unadjusted.
