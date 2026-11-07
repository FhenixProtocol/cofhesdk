---
'@cofhe/react': minor
---

Corrects the ACP forms of `CofheFloatingButtonWithProvider` to count the chosen duration from the latest block's timestamp (or the local clock, when that block is older), as the ACL checks expiry against the block. Previously they used the local clock alone, so on a Hardhat node moved 30 days ahead with `time.increase` a new 1 week ACP was already expired and every decrypt with it failed.

Adds `durationSeconds` to `useCofheCreateACP`, an alternative to `expirationSeconds` counted the same way.
