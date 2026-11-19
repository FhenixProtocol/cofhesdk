---
'@cofhe/react': patch
---

Corrects `CofheProvider`'s transaction tracking to keep a transaction pending, and keep polling for its receipt, when the receipt fetch fails. Previously any RPC error while waiting marked the transaction Failed in the store and skipped the balance refresh, so a shield that had mined successfully could show as Failed until the page was reloaded.
