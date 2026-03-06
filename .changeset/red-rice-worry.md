---
'@cofhe/hardhat-plugin': patch
'@cofhe/mock-contracts': patch
---

Export typechain types for mock contracts. Update `hre.cofhe.mocks.getPlaintext` and `hre.cofhe.mocks.expectPlaintext` to accept bytes32 (string) ctHashes to work with cofhe-contracts 0.1.0.
