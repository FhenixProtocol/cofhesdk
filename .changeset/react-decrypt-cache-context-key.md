---
'@cofhe/react': patch
---

`useCofheDecrypt` now scopes its cache key to the connected chain, account and active ACP hash (`['decryptCiphertext', chainId, account, acpHash, ctHash, utype]`) instead of just `ctHash` + `utype`. A decrypted value obtained under one account/ACP could previously be served from cache after switching account, chain or ACP for the same handle. `useCofheDecryptionActivity` and the stale-decrypt cleanup in `useCofheReadContractAndDecrypt` read `ctHash`/`utype` from the tail of the key so they keep working with the wider prefix.
