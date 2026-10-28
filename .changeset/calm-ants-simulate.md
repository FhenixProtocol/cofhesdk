---
'@cofhe/react': patch
---

Corrects `useCofheSimulateWriteContract` to key its cache on every simulation option that affects the result, such as `blockNumber`, `blockTag` and `stateOverride`, and to leave `enabled` out of the key. Previously two simulations that differed only in those options shared one cached result.
