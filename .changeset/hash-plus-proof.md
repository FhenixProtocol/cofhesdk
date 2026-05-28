---
'@cofhe/sdk': patch
---

Add hash-plus-proof (HPP) support to `EncryptInputsBuilder`.

Calling `.asHashPlusProof()` on the builder transitions its type parameter to `HPP = true`, causing `.execute()` to return `HashPlusProofResult<T>` — a typed tuple of per-input `External*Hash` values followed by a single `ExternalHashProof`, matching the Solidity `externalEbool` / `externalEuint*` / `externalEaddress` type aliases.

New public types exported from `@cofhe/sdk`:
- `ExternalBoolHash`, `ExternalUint8Hash`, `ExternalUint16Hash`, `ExternalUint32Hash`, `ExternalUint64Hash`, `ExternalUint128Hash`, `ExternalAddressHash` — branded `0x${string}` types discriminated by `utype`
- `ExternalHashProof` — branded `0x${string}` proof blob
- `AnyExternalHash` — union of all `External*Hash` types
- `EncryptableToExternalHashMap<E>` — maps a single `EncryptableItem` to its `External*Hash`
- `ExternalItemHashes<T>` — maps an `EncryptableItem[]` tuple to the corresponding hash tuple
- `HashPlusProofResult<T>` — `[...ExternalItemHashes<T>, ExternalHashProof]`
