---
'@cofhe/react': patch
---

**Breaking:** `CofheProvider` takes either `config` or `cofheClient`, not both (passing both throws). With a pre-created client, pass only `cofheClient`; the provider uses the config it was created with.
