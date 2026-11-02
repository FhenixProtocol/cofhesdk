---
'@cofhe/sdk': patch
---

Corrects `encryptInputs` on a mocks chain to register the encrypted inputs through the connected node when no zk verifier wallet client is configured. Previously it always sent to `127.0.0.1:8545`, so a node on another port or host failed with `ZkMocksInsertCtHashesFailed`.
