---
'@cofhe/sdk': patch
---

Changes `encryptInputs` to leave the page responsive while a Web Worker makes the proof. Previously every encrypt froze the main thread for a few hundred milliseconds before the worker started, enough to stall an animation. The `Pack` step is still reported; with a worker its end event has `packedInWorker: true`.
