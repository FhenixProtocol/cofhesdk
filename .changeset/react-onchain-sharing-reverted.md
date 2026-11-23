---
'@cofhe/react': patch
---

`useCofheRevokeACP`, `useCofheShareOnChain` and `useCofheRemoveShare` now reject when the mined transaction reverted. They used to resolve and call `onSuccess`, so the UI reported a revocation, share or removal that never happened on chain.
