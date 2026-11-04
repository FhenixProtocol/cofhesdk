---
'@cofhe/sdk': patch
---

Changes `encryptInputs` to keep working from in-memory FHE keys when the configured key storage fails to read or write, logging one warning. Previously a storage that could not be read made every `encryptInputs` call throw `REHYDRATE_KEYS_STORE_FAILED`, and a write that failed surfaced as an unhandled promise rejection.
