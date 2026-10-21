---
'@cofhe/sdk': patch
---

`acp.revokeACP` and `acp.revokeAllACPs` now work with a wallet client that has no `chain`, as `shareOnChain` already does. Previously they threw `No chain was provided to the request` for a JSON-RPC account without a chain, which is the client `hre.cofhe.createClientWithBatteries()` builds in both Hardhat plugins.
