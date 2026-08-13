---
'@cofhe/sdk': minor
'@cofhe/mock-contracts': minor
'@cofhe/hardhat-plugin': minor
'@cofhe/hardhat-3-plugin': minor
'@cofhe/foundry-plugin': minor
'@cofhe/react': minor
---

**Breaking: Permit (V2) → ACP (Access Control Permission).** Permits become scoped, revocable ACPs; old names are removed rather than deprecated. Highlights (full list in BREAKING-CHANGES.md):

- `Permit`/`Permission`/`PermitUtils`/`client.permits` → `ACP`/`ACPPublic`/`ACPUtils`/`client.acp`; `getPermission()` → `getPublic()`
- `ACPPrivate` & `ACPPublic` are top-level types, `ACP` is the union; the sealing keypair is flattened to `sealingPrivateKey`/`sealingKey` (the `SealingKey` class is removed)
- New scope fields (`scope`, `contracts`, `handles: bytes32[]`) and revocation fields renamed `validatorId`/`validatorContract` → `revokerData`/`revokerContract`; default revoker `ACPTimestampRevoker` with `revokePermit`/`revokeAllPermits`/`isPermitRevoked` on the client
- EIP-712 domain bumped to `("ACL", "2")` with new `ACPIssuerSelf`/`ACPIssuerShared`/`ACPRecipient` types — previously signed permits no longer verify; the permit store migrates by wiping retired-format permits
- `ACPUtils.export()` produces a fixed `SharedACP` shape and only accepts signed sharing ACPs
