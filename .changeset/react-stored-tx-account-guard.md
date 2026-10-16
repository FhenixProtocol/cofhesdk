---
'@cofhe/react': patch
---

`useStoredTransactions` no longer throws when filtering by account against legacy persisted transactions that omit `account`. Same guard pattern as `getAllTransactions` / `getAllTransactionsByToken`.
