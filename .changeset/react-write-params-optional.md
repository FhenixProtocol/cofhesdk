---
'@cofhe/react': patch
---

`useCofheWriteContract`'s `writeContract` / `writeContractAsync` no longer require `chain` and `account` in the call — both come from the connected wallet, as they always did at runtime (`account` defaults to the wallet's, `chain` only ever informed the simulation). The same applies to everything built on it: `useCofheEncryptAndWriteContract`'s `encryptAndWrite`, `useCofheTokenApprove`, `useCofheTokenTransfer`. Callers that cast the call `as never` to get past the two required fields can drop the cast and get the ABI's `functionName` / `args` checking back. Passing `chain` or `account` explicitly is still accepted.
