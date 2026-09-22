---
'@cofhe/sdk': minor
---

fix(sdk): cache the CRS per security zone

`fetchCrs` requested the CRS for a given `securityZone` but cached it under the chain id alone, while `fetchFhePublicKey` next to it keys by `(chainId, securityZone)`. After encrypting on one zone, `encryptInputs` on a different zone read the first zone's CRS back out of the store. It deserializes fine, so the stale CRS passed the validity check and was used to build the proof, which the ZK verifier then rejects.

CoFHE serves a distinct CRS per zone: `POST /GetCrs` with `securityZone: 0` and `securityZone: 1` against `testnet-cofhe.fhenix.zone` returns two different 7,968,512-byte values.

`KeysStore.crs` is now keyed by chain and zone like `KeysStore.fhe`, `getCrs(chainId, securityZone = 0)` takes the zone, and `setCrs(chainId, securityZone, crs)` matches `setFheKey`'s argument order. A `crs` persisted under the old shape holds a bare string per chain; those entries are dropped on rehydrate so the CRS is refetched per zone instead of being indexed as a string.
