---
'@cofhe/sdk': minor
'@cofhe/react': minor
---

Tighten permit validation and treat invalid permits as missing.

- SDK: `PermitUtils.validate` now enforces schema + signed + not-expired (use `PermitUtils.validateSchema` for schema-only validation).
- SDK: `ValidationResult.error` is now a typed union (`'invalid-schema' | 'expired' | 'not-signed' | null`).
- React: rename `disabledDueToMissingPermit` to `disabledDueToMissingValidPermit` in read/decrypt hooks and token balance helpers, and disable reads when the active permit is invalid.
