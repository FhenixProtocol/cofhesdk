---
'@cofhe/mock-contracts': patch
---

`MockTaskManager.createRandomTask` now works like the real task manager: the handle carries the requested type and security zone, the caller gets transient access, the zone is validated and a value is stored, so `FHE.random*` handles can be allowed and computed on in Hardhat and Foundry tests.
