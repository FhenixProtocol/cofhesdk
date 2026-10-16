---
'@cofhe/hardhat-3-plugin': patch
'@cofhe/hardhat-plugin': patch
---

**@cofhe/hardhat-3-plugin**

Corrects `cofhe.mocks.deployMocks()` to fall back to the `cofhe` config for `gasWarning`, `mocksDeployVerbosity` and `logMocks`, like the deploy on `network.connect()`. Previously a re-deploy printed the gas warning with `gasWarning: false` (the default), ignored `mocksDeployVerbosity: ''`, and left FHE operation logs off with `logMocks: true`.

**@cofhe/hardhat-plugin**

Corrects `hre.cofhe.mocks.deployMocks()` to fall back to `gasWarning` from the `cofhe` config. Previously a re-deploy never printed the gas warning, even with `gasWarning: true`.
