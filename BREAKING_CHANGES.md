# Breaking change: encrypted inputs are now bound to a consuming contract

This branch implements [`FhenixProtocol/cofhe-contracts#77`](https://github.com/FhenixProtocol/cofhe-contracts/pull/77)
(`TaskManager: bind consuming contract in verifyInput signature`) against the legacy
one-signature-per-ciphertext verification scheme. It targets a staging `zee-k-verifier`
environment that has this fix but not the separate batch-verification work
(`cofhe-contracts#78`) — see `zee-k-verifier#37` for the real verifier-service change.

## Why

`TaskManager.verifyInput` previously signed `keccak256(ctHash || utype || securityZone || sender || chainId)`.
Since a signed input packet travels in public calldata, an attacker could lift a victim's
valid packet and replay it into a *different* contract than the one it was signed for —
`verifyInput` is permissionless and hands the caller a transient ACL allowance over the
resulting handle. This fix closes that by folding the consuming contract (the caller of
`FHE.asEuint*`, i.e. `msg.sender` as seen by the TaskManager) into the signed message:

```
keccak256(ctHash || utype || securityZone || sender || chainId || contractAddress)
```

Because the SDK/mocks compute this signature **off-chain, before** any transaction happens,
the caller must now declare in advance which contract will consume the result.

**There is no backwards-compatibility shim.** `setConsumingContract` is required before
`.execute()` — there is no default (falling back to `msg.sender` at execute time would defeat
the point: the caller must commit to the target contract before signing).

## `@cofhe/sdk`

- **New, required** `EncryptInputsBuilder.setConsumingContract(address)` / `.getConsumingContract()`.
  `execute()` throws `CofheErrorCode.ConsumingContractUninitialized` if it was never called.
- **Changed** signature digest (mocks path, `cofheMocksZkVerifySign.ts`): folds in the
  consuming contract per the formula above.
- **Changed** production request: `zkVerify` now sends a `contract_address` field to
  `POST /verify`, alongside the existing `account_addr`/`security_zone`/`chain_id`. Field name
  confirmed against the real verifier service's `VerifyRequest` struct (`zee-k-verifier#37`).

## `@cofhe/mock-contracts`

- `MockTaskManager.sol`: `extractSigner` gains a third `contractAddress` parameter, folded into
  the digest exactly as above. `verifyInput`'s **external ABI is unchanged** — `contractAddress`
  is read from `msg.sender` inside the TaskManager (the immediate caller of `verifyInput`), not
  passed as an argument, matching the real fix exactly.

## `@cofhe/foundry-plugin`

- **Changed signature**: every `CofheClient.createIn*`/`createIn*_asHashPlusProof` helper
  (`createInEbool`, `createInEuint8`...`createInEuint128`, `createInEaddress`, and their
  `_asHashPlusProof` variants) takes a new final `address consumingContract` parameter —
  the contract that will consume the resulting encrypted input. There is no global setter;
  the caller passes it at each call site, e.g. `cofheClient.createInEuint32(42, address(myContract))`.
  Reverts with `'CofheClient: consuming contract must not be the zero address'` if
  `address(0)` is passed.
- `MockZkVerifierSigner.zkVerifySign`/`zkVerifySignPacked` gained a required
  `consumingContract` parameter.
- Existing Foundry tests that create encrypted inputs now pass
  `address(targetContract)` as the last argument to every `createIn*` call.

## `@cofhe/react`

- `EncryptionOptions`/`EncryptInputsOptions` (used by `useCofheEncrypt`) gained an optional
  `consumingContract` field, threaded through to `builder.setConsumingContract(...)`.
- `useCofheEncryptAndWriteContract` now defaults `consumingContract` to the write's target
  `address` automatically (the one call site where the consuming contract is already
  unambiguously known) — an explicit `encryptionOptions.consumingContract` still overrides this.
