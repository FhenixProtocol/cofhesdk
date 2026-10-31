---
'@cofhe/sdk': patch
---

Corrects `encryptInputs(...).execute()` to bind the proof to the full chain id on chains whose id is 2^32 or more. Previously only its low 32 bits were kept (chain `37714555429` was proven as `3354817061`), so the proof did not match the chain id sent to the verifier.
