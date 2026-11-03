---
'@cofhe/sdk': patch
---

`encryptInputs(...).execute()` in `@cofhe/sdk/web` now starts a new proving worker when the previous one failed to start. Previously one failed start (for example the worker script failing to load) was kept for the rest of the session, so every later proof silently ran on the main thread.
