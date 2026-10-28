---
'@cofhe/sdk': patch
---

Corrects `acp.revokeACP` and `acp.revokeAllACPs` to work with a wallet client that has no `chain`, as `acp.shareOnChain` already does. Previously they threw `No chain was provided to the request` with the client `hre.cofhe.createClientWithBatteries()` builds.
