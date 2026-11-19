---
'@cofhe/sdk': minor
---

Changes `encryptInputs`, `decryptForView` and `decryptForTx` to no longer throw `NOT_CONNECTED` when called before `connect`. `execute()` now rejects instead, with `ACCOUNT_UNINITIALIZED` or `CHAIN_ID_UNINITIALIZED`.

Deprecates `MISSING_PUBLIC_CLIENT` and `MISSING_WALLET_CLIENT`, which are never thrown now. Adds `MISSING_MOCKS_REQUEST_FN` to `CofheErrorCode`, which can break an exhaustive `switch` or `Record` over the codes at compile time.
