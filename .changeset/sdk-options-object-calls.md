---
'@cofhe/sdk': minor
---

Adds an options-object form of `encryptInputs`, `decryptForView` and `decryptForTx` that runs the operation in one call, next to the builders: `await client.encryptInputs(inputs, { consumingContract })`.

- `client.encryptInputs(inputs, { consumingContract, account?, chainId?, securityZone?, useWorker?, onStep? })`
- `client.decryptForView(ctHash, utype, { acp?, chainId?, account?, onPoll?, accessDeniedRetryTimeout? })`; pass `{}` for the defaults
- `client.decryptForTx(ctHash, { acp: 'none' | 'active' | acp, … })`
- `decryptForView` also takes the type by name: `'uint64'` in place of `FheTypes.Uint64`
- Types `EncryptInputsOptions`, `DecryptForViewOptions`, `DecryptForTxOptions`

Adds `createCofheClient` and `createCofheConfig` to `@cofhe/sdk` as stubs that fail with the new code `WRONG_ENTRYPOINT` and name `@cofhe/sdk/node` and `@cofhe/sdk/web`. Previously that import failed with "has no exported member". The new `CofheErrorCode.WrongEntrypoint` can break an exhaustive `switch` or `Record<CofheErrorCode, …>`.

Changes `createCofheClient` from `@cofhe/sdk/node` to return `CofheClient<TConfig>`, typed by the config passed in, as the `@cofhe/sdk/web` one does.
