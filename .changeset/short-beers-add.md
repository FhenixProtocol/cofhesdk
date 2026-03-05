---
'@cofhe/hardhat-plugin': patch
'@cofhe/sdk': patch
---

Adds `config.mocks.encryptDelay: number | [number, number, number, number, number]` to allow configurable mock encryption delay. Defaults to 0 delay on hardhat to keep tests quick.
