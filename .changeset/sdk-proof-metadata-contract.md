---
'@cofhe/sdk': minor
---

The ZK proof built by `encryptInputs` now carries the consuming contract in its metadata (`securityZone || account || chainId || consumingContract`), so the proof itself is bound to the contract it was built for, matching the verifier's signed digest. No API change: `setConsumingContract` was already required.

**Requires a verifier that expects the new layout** (zee-k-verifier with "Extend the proof metadata"). Against an older verifier every `encryptInputs` call fails with `ZK_VERIFY_FAILED`; deploy the two together, as with 0.7.0.
