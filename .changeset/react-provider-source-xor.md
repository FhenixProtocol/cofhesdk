---
'@cofhe/react': patch
---

`CofheProvider` now rejects `config` and `cofheClient` when they are supplied together. The props are mutually exclusive at the type level, and untyped JavaScript callers receive a clear runtime error instead of creating separate configuration and client sources.
