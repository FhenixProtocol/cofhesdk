---
'@cofhe/sdk': patch
---

Corrects `encryptInputs` to send the proof to the verifier again when it answers 503 (busy), waiting for its `Retry-After` up to three times. Previously one busy response failed the whole encrypt with `ZK_VERIFY_FAILED` and the generated proof was thrown away.
