---
'@cofhe/react': patch
---

Corrects `useTokensWithPublicBalances` and `useCofheTokensWithExistingEncryptedBalances` to skip their balance reads while an explicit `chainId` differs from the connected chain. Previously they listed that chain's tokens but read the balances on the connected chain, so Sepolia fhETH showed the wallet's Base Sepolia ETH.
