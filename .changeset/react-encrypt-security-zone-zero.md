---
'@cofhe/react': patch
---

Corrects `useCofheEncrypt` to pass `securityZone: 0` and `chainId: 0` through to the encrypt builder. Previously a truthy check skipped both, so zone 0 never bound the batch and item zones other than 0 were accepted silently.
