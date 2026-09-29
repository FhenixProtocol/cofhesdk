---
'@cofhe/react': patch
---

Plaintext decrypted with a shared (non-self) ACP is kept in memory only: it is no longer written to the persisted query cache. Decrypts cached under an explicitly chosen ACP are dropped when that ACP leaves the ACP store (e.g. `removeACP`) or when it expires while in use, so a revoked or expired share does not keep serving its values from cache.
