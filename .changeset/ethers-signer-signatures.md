---
'@cofhe/sdk': patch
---

Corrects `Ethers5Adapter` and `Ethers6Adapter` to sign messages and typed data through the supplied signer when it does not expose a private key. Previously these signature requests failed on read-only RPC endpoints; transaction submission still requires provider-side account support.
