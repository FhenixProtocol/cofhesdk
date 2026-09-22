---
'@cofhe/mock-contracts': patch
'@cofhe/foundry-plugin': patch
'@cofhe/hardhat-plugin': patch
'@cofhe/hardhat-3-plugin': patch
---

Realistic gas reporting for mocks. Under Foundry, mock-only work is now excluded from gas metering by default (opt out with `mockTaskManager.setMockGasExcluded(false)`), so expect `forge snapshot` numbers to drop. Under Hardhat, mock transactions emit `MockGasConsumed` events (extra receipt logs), and the plugins add `getAdjustedGasUsed(receipt)` / `getAdjustedGasBreakdown(receipt)` plus an opt-in `cofhe.gasSummary` report.
