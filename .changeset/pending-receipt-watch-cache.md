---
'@cofhe/react': patch
---

Corrects `CofheProvider` transaction tracking to record mined outcomes even when transaction history fetches the same receipt concurrently. Previously that overlap could leave a successful or reverted transaction permanently pending in the local history and skip its completion notifications and balance refreshes.
