---
'@cofhe/react': patch
---

Corrects `getAllTransactionsByToken` to keep persisted transactions that have no `account` when filtering by account, as `getAllTransactions` already does. Previously such an entry threw a `TypeError` and the whole token history failed to load.
