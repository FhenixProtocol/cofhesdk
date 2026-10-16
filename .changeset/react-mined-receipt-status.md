---
'@cofhe/react': patch
---

The pending-transaction tracker no longer marks a mined transaction as failed when its receipt's block hash can't be resolved or the watch is cancelled. The receipt status decides the outcome, invalidation falls back to an ungated refetch, and a cancelled watch leaves the transaction pending so it is picked up again.
