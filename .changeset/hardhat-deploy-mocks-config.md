---
'@cofhe/hardhat-3-plugin': patch
'@cofhe/hardhat-plugin': patch
---

`cofhe.mocks.deployMocks()` now uses the `cofhe` config for any option it is not given (`gasWarning`, `mocksDeployVerbosity`, `logMocks`), like the deploy that runs on connect. Previously a re-deploy in Hardhat 3 ignored all three, so it printed the gas warning and deploy summary and left FHE operation logs off, and in Hardhat 2 it ignored `gasWarning`.
