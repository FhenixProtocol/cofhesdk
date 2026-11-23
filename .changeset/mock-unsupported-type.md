---
'@cofhe/mock-contracts': patch
---

Corrects `MockTaskManager` to revert with `UnsupportedType` for the types the TaskManager rejects, and with `DecryptFunctionNotSupported` for a decrypt task. Previously encrypting, casting or generating a random value as `Utils.EUINT256_TFHE` passed in local tests but reverted on chain.
