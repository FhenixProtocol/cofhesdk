---
'@cofhe/hardhat-plugin': patch
---

The Hardhat 2 mock deployment now sets the same security zone range (`0..1`) on the mock TaskManager that the Hardhat 3 plugin uses, so inputs for security zone 1 no longer fail in Hardhat 2 mock tests.
