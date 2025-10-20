---
'@cofhe/sdk': patch
---

Add duration and context information to the step callback function for encryptInputs. Split fetch keys step into InitTfhe and FetchKeys.
InitTfhe context includes a `tfheInitializationExecuted` indicating if tfhe was initialized (true) or already initialized (false).
FetchKeys returns flags for whether the fhe and crs keys were fetch from remote (true) or from cache (false).
