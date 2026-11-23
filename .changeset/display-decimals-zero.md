---
'@cofhe/react': patch
---

Corrects `displayDecimals: 0` in `useCofheTokenPublicBalance`, `useCofheTokenDecryptedBalance` and `useTokensWithPublicBalances` to round the formatted balance to a whole number. Previously `0` was ignored and `1.234567` was shown at full precision.
