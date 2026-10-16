---
'@cofhe/react': patch
---

`useResolvedCofheToken` now reads `confidentialDecimals()` for dual tokens, so tokens imported by address format and parse confidential amounts with the right decimals instead of the public ERC-20 decimals.
