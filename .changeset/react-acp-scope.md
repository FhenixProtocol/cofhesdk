---
'@cofhe/react': minor
---

Decrypt with a chosen ACP in part of the tree without changing the active ACP. New `<CofheACPScope acp={acp | hash}>` and `useCofheACPScope()`; `useCofheReadContractAndDecrypt`, `useCofheReadContract`, `useCofheReadContracts` and `useCofheTokenDecryptedBalance` take an `acp` option that wins over the scope. Inside a scope `useCofheTokenDecryptedBalance` reads the ACP issuer balance unless given an account, and an invalid or unknown scoped ACP disables the reads (`disabledDueToMissingValidACP`) instead of falling back to the active ACP. The decrypt cache key gains a fifth segment, the hash of an explicitly chosen ACP (`undefined` for the active ACP), so a scoped decrypt never answers an unscoped one. New exported types: `CofheACPInput`, `CofheACPScopeValue`.
