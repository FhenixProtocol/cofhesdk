---
'@cofhe/react': patch
---

Corrects `useResolvedCofheToken` and `useTransactionReceiptsByHash` to stay disabled while an explicit `chainId` differs from the connected chain, as `useCofheReadContract` already does. Previously they read through the connected chain's client anyway and cached the result under the requested chain id.
