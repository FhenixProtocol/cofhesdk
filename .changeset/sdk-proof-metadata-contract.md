---
'@cofhe/sdk': patch
---

**Breaking:** `encryptInputs(...).execute()` now binds the consuming contract into the ZK proof itself, and the CoFHE verifier requires it. Upgrade to 1.0.1: 1.0.0 is deprecated because of an issue in ZK verification, and once the verifier is updated a proof from 1.0.0 fails with `ZK_VERIFY_FAILED`. No code change is needed beyond the upgrade; `setConsumingContract(...)` was already required.

`execute()` now throws `CofheError` with code `CONSUMING_CONTRACT_INVALID` when `setConsumingContract(...)` was given something that is not an address, before TFHE is initialised or any proving starts. Previously the bad address reached the verifier and failed there, after the proof was generated. `CofheErrorCode` gains `ConsumingContractInvalid`; an exhaustive `switch` over the enum needs the new arm.
