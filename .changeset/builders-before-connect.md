---
'@cofhe/sdk': minor
---

Changes `encryptInputs`, `decryptForView` and `decryptForTx` to depend only on the chain and account from `connect`, no longer on the connected public and wallet clients. Previously calling them before `connect` threw `NOT_CONNECTED`; now `execute()` rejects with `ACCOUNT_UNINITIALIZED` or `CHAIN_ID_UNINITIALIZED`.

Deprecates `MISSING_PUBLIC_CLIENT` and `MISSING_WALLET_CLIENT`, which are never thrown now. Adds `MISSING_MOCKS_REQUEST_FN` to `CofheErrorCode`, which can break an exhaustive `switch` or `Record` over the codes at compile time.
