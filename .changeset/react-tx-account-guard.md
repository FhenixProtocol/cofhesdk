---
'@cofhe/react': patch
---

Guard `getAllTransactionsByToken` when filtering by account so legacy entries without `account` do not throw.
