---
'@cofhe/sdk': patch
---

Changes `encryptInputs` to keep working from in-memory FHE keys when the configured key storage fails to read or write, logging one warning. Previously a storage that could not be read made every `encryptInputs` call throw `REHYDRATE_KEYS_STORE_FAILED`, and a write that failed surfaced as an unhandled promise rejection.

Adds `createWebStorage` to `@cofhe/sdk/web`: the default `fheKeyStorage`, so an app can wrap it (for example to report when the storage fails) and pass the wrapped storage in `createCofheConfig`.
