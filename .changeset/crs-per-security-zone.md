---
'@cofhe/sdk': minor
---

The CRS is now cached per security zone. It was fetched per zone but cached under the chain id alone, so after encrypting on zone 0, encrypting on zone 1 reused zone 0's CRS and produced a proof the ZK verifier rejects.

**Breaking (`KeysStorage`):** `crs` is now keyed by chain and zone, like `fhe`. `getCrs(chainId, securityZone = 0)` takes the zone, and `setCrs(chainId, securityZone, crs)` matches `setFheKey`'s argument order. A CRS persisted in the old per-chain shape is dropped on rehydrate and refetched.
