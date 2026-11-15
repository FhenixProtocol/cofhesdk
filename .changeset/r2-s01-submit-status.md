---
'@cofhe/sdk': patch
---

Corrects `tnDecryptV2` and `tnSealOutputV2` to reject a submit response the threshold network flags `FAILED`. Previously a 200 carrying that status alongside a result payload was returned as a genuine plaintext.
