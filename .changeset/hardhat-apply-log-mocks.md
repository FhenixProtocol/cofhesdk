---
'@cofhe/hardhat-plugin': patch
'@cofhe/hardhat-3-plugin': patch
---

`cofhe.logMocks: true` now turns on FHE operation logs when the mocks are deployed. The setting was resolved into the config but never applied, so logs stayed off unless a test called `enableLogs` or `withLogs`.
