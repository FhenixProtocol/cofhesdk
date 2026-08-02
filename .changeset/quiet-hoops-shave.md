---
'@cofhe/sdk': patch
---

Fix `fromHexString` silently producing zero bytes for malformed hex input. The `0x` prefix is now stripped before odd-length padding is applied, and non-hexadecimal characters throw a `CofheError` instead of being coerced to `0` via `NaN`.
