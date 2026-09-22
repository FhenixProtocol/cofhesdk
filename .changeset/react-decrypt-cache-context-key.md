---
'@cofhe/react': patch
---

`useCofheDecrypt` now includes the connected account and its active ACP hash in the decrypt cache key (`['decryptCiphertext', chainId, ctHash, utype, account, acpHash]`). The key already carried the chain, but after switching account or ACP on the same chain the plaintext decrypted under the previous account was still served from the (persisted) cache for the same handle. `useCofheReadContractAndDecrypt` evicts superseded entries with the same key.
