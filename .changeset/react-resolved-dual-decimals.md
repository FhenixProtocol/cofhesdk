---
'@cofhe/react': patch
---

Dual tokens resolved by address (`useResolvedCofheToken`) now use `confidentialDecimals()` for confidential amounts. Previously they used the public `decimals()`, so balances and entered amounts were off by the difference (10^12 for an 18/6 token).
