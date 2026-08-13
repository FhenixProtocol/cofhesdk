---
'@cofhe/sdk': minor
---

**ACP-era chains only.** The SDK signs and sends ACP (Permit V3) exclusively. Chains whose ACL still serves the pre-upgrade V2 `Permission` protocol are rejected with a clear error at permit-signing time (the ACL's `eip712Domain` version is probed and must be `"2"`). Decryption request bodies carry the ACP object under the `acp` key, and backend error handling recognizes the `acp_*` codes exclusively — seven map 1:1 onto the former `permit_*` codes, while revocation now surfaces as `acp_denied` (see BREAKING-CHANGES.md for the full table).
