---
'@cofhe/sdk': minor
'@cofhe/react': minor
---

**Backward compatibility: pre-upgrade (V2) chains are served through the unchanged ACP API.** The SDK probes which permit protocol each chain's ACL speaks (via the EIP-712 domain it serves) and routes automatically: upgraded chains use the ACP engine; chains still running the V2 ACL are signed for by the frozen legacy engine (`PermissionedV2*` typed data) and normalized into the same ACP shape, tagged `format: 'v2'`. Decryption payloads, on-chain validity checks, and `export()` follow the permit's protocol — old-SDK recipients can import exported V2 shares. Scoped permits and on-chain sharing degrade with explicit errors on V2 chains. `permit.aclVersion` config forces a version per chainId; `clearAclCaches()` (also exported from the node/web entries) forgets probe results after a known ACL upgrade.
