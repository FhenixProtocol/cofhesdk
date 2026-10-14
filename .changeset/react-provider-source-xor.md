---
'@cofhe/react': patch
---

**Breaking:** `CofheProvider` takes either `config` or `cofheClient`, not both. Passing both is a type error and throws at render. To use a pre-created client, pass `cofheClient` alone; the provider takes the React settings from the config the client was created with (`createCofheClient(config)`). `CofheProviderProps` is now a union type, so extend it with `type MyProps = CofheProviderProps & { … }` instead of an `interface … extends`.
