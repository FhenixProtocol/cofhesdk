---
'@cofhe/contract-check': minor
---

New package: static checks for the encrypted-type boundary conventions.

Encrypted values travel as handles, and a contract is normally ACL-allowed on the handles it
works with — so a function accepting a raw `euint64` from outside can be made to compute on
someone else's ciphertext with its own authority. The `sharedE*` / `externalE*` types close that
hole, but only if signatures follow the convention. This package checks that they do.

Reads solc build-info (Hardhat or Foundry), so types arrive already resolved by the compiler:

- `no-raw-encrypted-params` — external/public must not accept raw encrypted types (follows
  structs and arrays)
- `no-raw-encrypted-returns` — external/public state-mutating must not return them; `view`/`pure`
  exempt
- `no-raw-shared-wrap` — `sharedE*.wrap`/`.unwrap` only inside the FHE library
- `external-input-missing-proof` — external inputs need the proof bytes that verify them
- `proof-placement` — opt-in house style (`proofStyle: 'trailing' | 'per-value'`), silent by
  default since the library supports both arrangements
- `receive-variant` — `receive*Param` vs `receive*FromCall` must match the value's origin,
  reported only where that origin is locally provable

Ships a library API and a `contract-check` CLI that exits non-zero on errors, so
`hardhat compile && contract-check` works as a CI gate.
