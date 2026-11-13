---
'@cofhe/react': patch
---

Routes the active ACP through the same on-chain revocation check that scoped / `acp:` paths already use. An imported share made active with `selectActiveACP` no longer keeps reads and decrypts gated on after the issuer revokes it.
