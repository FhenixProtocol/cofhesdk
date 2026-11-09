---
'@cofhe/sdk': patch
---

Changes `encryptInputs` to keep working when the key storage fails to read or write: the default web storage falls back from the shared `iframe-shared-storage` hub to the page's own IndexedDB, and any storage that still fails is given up for the session with the keys kept in memory, with one warning each time. Previously a storage that could not be read made every `encryptInputs` call throw `REHYDRATE_KEYS_STORE_FAILED`, and a write that failed surfaced as an unhandled promise rejection.

Adds `createWebStorage` and `createIndexedDbStorage` to `@cofhe/sdk/web`: the default `fheKeyStorage` and its same-origin fallback. `createWebStorage({ onFallback })` reports the switch to the fallback (which call failed, and the error), so an app can count sessions that lost the shared storage; the result is passed as `fheKeyStorage` in `createCofheConfig`.
