---
'@cofhe/hardhat-plugin': patch
---

`mock_getPlaintext`, `mock_getPlaintextExists` and `mock_expectPlaintext` now skip on non-mock networks as intended. The check compared `getCode`'s result to an empty string, but `eth_getCode` returns `"0x"` for an empty address, so on a real network these helpers called into the TaskManager and failed with an opaque error. It now matches `@cofhe/hardhat-3-plugin`.
