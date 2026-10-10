---
'@cofhe/mock-contracts': patch
---

`MockTaskManager.createTask` now validates `trivialEncrypt` inputs like the real task manager: `FHE.asEuint8(256)` and the other `FHE.asE*` calls with a value that does not fit the type revert with `InvalidInputForFunction`, and an out of range security zone reverts with `InvalidSecurityZone`, instead of the value being stored masked.
