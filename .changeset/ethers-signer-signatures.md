---
'@cofhe/sdk': patch
---

Corrects `Ethers5Adapter` and `Ethers6Adapter` to sign messages and typed data through the supplied signer when it does not expose a private key. Previously these signing requests went to the provider, preventing capable signers from working with read-only RPC endpoints.
