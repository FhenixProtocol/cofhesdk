---
'@cofhe/sdk': patch
---

`defaultACPExpiration` now sets how long the ACPs the client creates last, counted from the latest block. It was never applied: every ACP expired 7 days after the local clock whatever the config said, so on a chain ahead of the local clock (a Hardhat test after `time.increase`) a new ACP could already be expired. Its default is now 7 days, the lifetime ACPs already had.
