---
'@cofhe/sdk': minor
---

**ACP-era chains only.** The SDK signs and sends ACP (Permit V3) exclusively. Chains whose ACL still serves the pre-upgrade V2 `Permission` protocol are rejected with a clear error at permit-signing time (the ACL's `eip712Domain` version is probed and must be `"2"`). Decryption request bodies carry the ACP object under the `acp` key, and all `acp_*` backend error codes are recognized alongside their legacy `permit_*` counterparts.
