---
'@cofhe/sdk': patch
---

Corrects `CofheClient.acp.getIncomingShares` to use the account resolved during connection when listing incoming shares. Previously connecting a wallet without a preconfigured account succeeded, but opening its incoming shares failed with a property access error instead of reading the recipient's registry entries.
