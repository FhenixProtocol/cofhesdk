---
'@cofhe/sdk': patch
---

Corrects `encryptInputs` to reject an empty list with `ZkPackFailed`, on Hardhat as on a live network. Previously `encryptInputs([])` returned a lone signature on Hardhat, while a live network built and sent the proof and the verifier answered with HTTP 400.
