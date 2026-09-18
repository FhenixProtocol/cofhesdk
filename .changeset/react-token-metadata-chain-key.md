---
'@cofhe/react': patch
---

`useCofheTokenMetadata` now includes the connected chain id in its query key. Metadata was cached by token address only, so the same address deployed on several chains could show another network's name/symbol/decimals after a chain switch.
