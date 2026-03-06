---
'@cofhe/abi': patch
'@cofhe/sdk': patch
'@cofhe/hardhat-plugin': patch
'@cofhe/mock-contracts': patch
---

Aligns with CTA encrypted variables bytes32 representation.

- **@cofhe/hardhat-plugin**: `hre.cofhe.mocks.getTestBed()`, `getMockTaskManager()`, `getMockACL()`, `getMockThresholdNetwork()`, and `getMockZkVerifier()` now return typed contracts (typechain interfaces) instead of untyped `Contract`. `getPlaintext(ctHash)` and `expectPlaintext(ctHash, value)` now accept bytes32 ctHashes as `string` support cofhe-contracts 0.1.0 CTA changes.

- **@cofhe/mock-contracts**: Export typechain-generated contract types (`TestBed`, `MockACL`, `MockTaskManager`, `MockZkVerifier`, `MockThresholdNetwork`) for use with the hardhat plugin. Typechain is run from artifact ABIs only; factory files are not generated.

- **@cofhe/abi**: CTA-related types use `bytes32` (string) instead of `uint256`. Decryption and return-type helpers aligned with cofhe-contracts 0.1.0.

- **@cofhe/sdk**: Decryption APIs (`decryptForTx`, `decryptForView`, and related builders) now also accept `string` for ciphertext hashes (bytes32) as well as `bigint`.
