---
'@cofhe/hardhat-plugin': minor
'@cofhe/mock-contracts': minor
'@cofhe/react': minor
'@cofhe/sdk': minor
---

implement decrypt-with-proof flows and related tests:

- Implement production `decryptForTx` backed by Threshold Network `POST /decrypt`, with explicit permit vs global-allowance selection.
- Rename mocks “Query Decrypter” -> “Threshold Network” and update SDK constants/contracts/artifacts accordingly.
- Extend mock contracts + hardhat plugin to publish & verify decryption results on-chain, and add end-to-end integration tests.