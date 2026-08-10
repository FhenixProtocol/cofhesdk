---
'@cofhe/sdk': minor
'@cofhe/mock-contracts': minor
'@cofhe/react': minor
'@cofhe/foundry-plugin': minor
---

Bind encrypted inputs to a consuming contract (`FhenixProtocol/cofhe-contracts#77`). The verifier-signed digest now includes the contract that will consume the ciphertext, closing a replay path where a signed input packet observed on-chain could be reused against a different contract than the one it was signed for.

**Breaking:** `EncryptInputsBuilder.setConsumingContract(address)` must be called before `.execute()` - it throws `ConsumingContractUninitialized` otherwise. `@cofhe/mock-contracts`'s `MockTaskManager` signature digest changed to include the consuming contract (external ABI unchanged). `@cofhe/foundry-plugin`'s `CofheClient.createExternal*`/`createEuint32sBatch` helpers now take a required `address consumingContract` as their last parameter (no global setter). `@cofhe/react`'s `useCofheEncryptAndWriteContract` defaults `consumingContract` to the write's target address automatically; `useCofheEncrypt` accepts it as an explicit option. See `BREAKING_CHANGES.md` for full details.
