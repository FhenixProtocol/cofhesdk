# Breaking changes: migration to batch input verification

This document logs the breaking changes made while migrating `cofheClient.encryptInputs`
(and everything built on top of it) from the legacy **one-signature-per-ciphertext**
verification scheme to the new **one-signature-per-batch** scheme described in
`BATCH_SIGNATURE_CHANGES.md` (`POST /verifyBatch`) and implemented on-chain by
[`FhenixProtocol/cofhe-contracts#78`](https://github.com/FhenixProtocol/cofhe-contracts/pull/78).

**There is no backwards-compatibility shim.** A single batch signature cannot be split
back into N valid per-item signatures, so the old output shape is gone, not deprecated.

---

## Why

`cofheClient.encryptInputs(...).execute()` used to return an array of `EncryptedItemInput`
structs — one **valid signature per ciphertext**. The new `/verifyBatch` endpoint (and the
matching on-chain `batchVerifyInputs`) issues **one signature for the whole batch**, computed
over `keccak256(h_0 || h_1 || ... || h_n)`. You cannot derive N valid individual signatures
from that single signature, so the per-item-struct output had to be removed outright.

The shape that replaces it — an ordered array of ciphertext hashes followed by one shared
signature — is exactly what the old, rarely-used `.asHashPlusProof()` mode approximated. That
mode's per-item signature _concatenation_ was already invalid for batches of more than one
item; the real batch signature fixes this properly. `.asHashPlusProof()` is now simply what
`execute()` always returns, so the opt-in method is gone.

---

## `@cofhe/sdk`

- **Removed types** (`packages/sdk/core/types.ts`): `EncryptedItemInput`, `EncryptedBoolInput`,
  `EncryptedUint8Input`, `EncryptedUint16Input`, `EncryptedUint32Input`, `EncryptedUint64Input`,
  `EncryptedUint128Input`, `EncryptedAddressInput`, `EncryptableToEncryptedItemInputMap`,
  `EncryptedItemInputs<T>`, `assertCorrectEncryptedItemInput`.
- **Removed** `EncryptInputsBuilder.asHashPlusProof()` and its `HPP` generic type parameter.
  `EncryptInputsBuilder<T>` now takes a single type parameter.
- **Changed** `EncryptInputsBuilder.execute()`: always returns `HashPlusProofResult<T>` —
  `[...hashes, signature]`, one hash per encrypted input (in order) followed by the single
  batch signature. Previously this was the array of `EncryptedItemInput` structs by default.
- **Removed** `zkVerify`, `VerifyResult`, `VerifyResultRaw` (`packages/sdk/core/encrypt/zkPackProveVerify.ts`) —
  the per-ciphertext `/verify` HTTP client.
- **Added** `zkVerifyBatch`, `VerifyBatchResult`, `VerifyBatchResultRaw`, `VerifyBatchOutputRaw` —
  the `/verifyBatch` HTTP client.
- **Changed** `ExternalHashProof`: now documents that it's a real ECDSA batch signature (not a
  naive per-item signature concatenation, which is what it degenerated to previously for N>1).
- **Deleted** `packages/sdk/core/encrypt/encryptUtils.ts` (`encryptReplace`/`encryptExtract`) —
  dead code, unused anywhere in the repo, built entirely around the now-deleted
  `EncryptedItemInput` type.
- The mock-chain signer (`cofheMocksZkVerifySign.ts`) now signs one batch digest per call
  instead of looping per item — this is the single canonical signer implementation used by
  the SDK's hardhat-mocks path.

## `@cofhe/abi`

- **Removed**: automatic ABI-driven detection/insertion of `struct InEbool`/`InEuint8`/
  `InEuint16`/`InEuint32`/`InEuint64`/`InEuint128`/`InEaddress` tuple shapes in
  `extractEncryptableValues`/`insertEncryptedValues` (`packages/abi/src/encryptedInputs.ts`).
- **Added**: automatic detection of `externalEbool`/`externalEuint8`/`externalEuint16`/
  `externalEuint32`/`externalEuint64`/`externalEuint128`/`externalEaddress` — plain
  `bytes32`-typed value types, not structs.
- **New calling convention**: any ABI function with one or more `external*` inputs must have
  its **last parameter be a plain `bytes`** — the slot that receives the shared batch
  signature. `extractEncryptableValues`/`insertEncryptedValues` throw a clear error if a
  function has `external*` inputs but its last parameter isn't `bytes`.
- **Changed** `insertEncryptedValues`'s `encryptedValues` parameter: was
  `readonly EncryptedItemInput[]` (one struct per encrypted arg), now
  `readonly \`0x${string}\`[]`— the`[...hashes, signature]`shape returned by`EncryptInputsBuilder.execute()`.
- **Changed** `CofheInputArgsPreTransform<abi, functionName>`: now computed at the function
  level — when the function has `external*` inputs, the trailing signature parameter is
  dropped from the pre-transform shape entirely (callers never supply it; the SDK injects it
  after encryption).
- **Changed** `FhenixInternalTypeMap` (`packages/abi/src/fhenixMap.ts`): removed the
  `'struct InEbool'`/etc. entries, added `externalEbool`/etc. entries mapping to the SDK's
  `External*Hash` branded types.
- **Changed** `mockEncrypt`/`mockEncryptEncryptable` (`packages/abi/src/mockEncrypt.ts`): now
  return a hash / `[...hashes, signature]` instead of `EncryptedItemInput` struct(s).

## `@fhenixprotocol/cofhe-contracts` (external dependency — version bump)

`FhenixProtocol/cofhe-contracts#78` first shipped in `0.2.0-beta.1`, so the temporary `pnpm patch`
that carried these changes has been removed. The repo now pins **`0.2.0-beta.3`**, which adds the
`sharedEuintXX` family on top (see below). `packages/mock-contracts`, `packages/foundry-plugin` and
`test/setup` pin `0.2.0-beta.3`; `packages/hardhat-plugin` requires `>=0.2.0-beta.3` as a peer.

> **Pre-release pin.** `0.2.0-beta.3` is a beta. The final `0.2.0` version must be pinned here
> before `@cofhe/*` `0.7.0` is published.

**This bump breaks your own Solidity.** The published `0.2.0-beta.1` does not just add the batch
path — it removes the legacy single-item one. Contracts written against `InEuintXX` will not
compile.

### Removed (compile errors)

| Removed from   | Symbols                                                                                             |
| -------------- | --------------------------------------------------------------------------------------------------- |
| `ICofhe.sol`   | `struct InEbool`, `InEuint8`, `InEuint16`, `InEuint32`, `InEuint64`, `InEuint128`, `InEaddress` (7) |
| `FHE.sol`      | `FHE.asEbool(InEbool)` … `FHE.asEaddress(InEaddress)` — the struct-taking overloads (7)             |
| `ICofhe.sol`   | `Utils.inputFromEbool(...)` … `Utils.inputFromEaddress(...)` (7)                                    |
| `ITaskManager` | `verifyInput(EncryptedInput, address)`                                                              |

### Added

- `ICofhe.sol`: `struct UnsignedEncryptedInput { uint256 ctHash; uint8 securityZone; uint8 utype; }`
  — like `EncryptedInput`, minus the per-item `signature`; and
  `ITaskManager.batchVerifyInputs(UnsignedEncryptedInput[], address sender, bytes signature)`.
- `FHE.sol`: `Impl.verifyBatchInputs` plumbing; `Utils.batchInputEntryFromBytes` /
  `Utils.batchInputsFromBytes`; new batch helpers `asEbools`, `asEuint8s`, `asEuint16s`,
  `asEuint32s`, `asEuint64s`, `asEuint128s`, `asEaddresses` (each with an `external*[]` and a
  `bytes[]` overload).

### Survives, but with different signature semantics

`FHE.asEuint32(externalEuint32 hash, bytes proof)` and its six siblings still exist and still
compile — but `Impl.verifyInput` now wraps the input into a one-element batch and calls
`batchVerifyInputs`:

```solidity
UnsignedEncryptedInput[] memory inputs = new UnsignedEncryptedInput[](1);
inputs[0] = UnsignedEncryptedInput(input.ctHash, input.securityZone, input.utype);
return verifyBatchInputs(inputs, input.signature)[0];
```

So `proof` must now be a **batch signature over a one-item batch**, not a legacy per-item
signature. A contract keeping this shape compiles cleanly and **reverts at runtime** if handed a
legacy signature. This is what `cofheClient.encryptInputs()` produces for a single input, so
single-value entry points can keep their existing ABI — for that shape the migration is
caller-side only.

## `@cofhe/mock-contracts`

- **Removed** `MockTaskManager.verifyInput` and `extractSigner` — the legacy single-item verifier.
  `ITaskManager` no longer declares `verifyInput`, so there is nothing left to conform to.
- **Added** `MockTaskManager.batchVerifyInputs(UnsignedEncryptedInput[], address, bytes)` — the
  only verification path now, including for single-item batches (n=1). `inputMessageHash` and
  `extractBatchSigner` are its digest/recovery helpers.
- ABI/typechain artifacts (`packages/mock-contracts/abi/*.json`, `src/*.ts`,
  `src/typechain-types/*`) regenerated to reflect the above.

## `@cofhe/foundry-plugin`

- **Removed** `MockZkVerifierSigner.zkVerifySignPacked` — it was a "fake batch": a loop
  producing N independent per-item signatures, not a real batch signature. Replaced by
  **`MockZkVerifierSigner.zkVerifyBatchSign`**, a genuine batch signer (one signature over
  `keccak256(h_0 || ... || h_n)`).
- **Renamed** the single-item encryption helpers: `createInEbool`/`createInEuint8`/…/
  `createInEuint128`/`createInEaddress` → **`createExternalEbool`/`createExternalEuint8`/…/
  `createExternalEuint128`/`createExternalEaddress`**. The old `createIn*` names described a
  return of `InEuintXX` **structs**; these helpers now return an `external*` handle plus a batch
  signature, so the names follow the types. The struct-returning variants and the separate
  `createIn*_asHashPlusProof` variants are both gone — there is now exactly one helper per type.
- **`CofheClient.createEncryptedInputsBatch` is now the root of every encryption helper on the
  client**, single-item or not. `createExternalEbool`...`createExternalEaddress` no longer sign via the
  legacy single-item digest — they call `createEncryptedInputsBatch` with a batch of size 1 and
  unwrap the result, so their returned `(hash, proof)` is a **batch signature**, not a legacy
  single-item signature.
  - **Breaking for consumers of these helpers**: the returned signature is a batch signature. It
    verifies via the batch path (`FHE.asEuint32s([hash], signature)` /
    `MockTaskManager.batchVerifyInputs`), which is the path every test in this repo exercises —
    see `EncryptedValueStore.storeEuint32Batch` in `test/CofhePlugin.t.sol` or
    `SimpleTest.setValueBatch` in `test/setup/contracts/SimpleTest.sol`.
  - In `cofhe-contracts` `0.2.0-beta.3`, `FHE.asEuint32(hash, proof)` also routes through
    `batchVerifyInputs` as a one-element batch (see the dependency section above), so a
    single-value entry point accepts a batch-of-1 signature unchanged. Covered by
    "Should accept a batch-of-1 signature via a single-value entry point" in
    `test/hardhat-plugin-test/test/encrypt-inputs.test.ts`.
  - **Removed** `MockZkVerifierSigner.zkVerifySign` (the legacy single-item signer) — nothing
    produces legacy single-item signatures anymore, and with `MockTaskManager.verifyInput`
    removed there is nothing left that would verify one.
- **Added** `CofheClient.createEncryptedInputsBatch` (generic, mixed-utype) and
  `CofheClient.createEuint32sBatch` (typed convenience wrapper) — build a batch and sign it via
  the canonical `zkVerifyBatchSign` path.
- **Added** `test/BatchVerifyInput.t.sol` — a new Foundry suite covering valid batch, wrong
  signer, tampered input, and debug-mode bypass, mirroring PR #78's own test additions.

## `@cofhe/react`

- `useCofheEncrypt`: return type changed from `readonly EncryptedItemInput[]` to
  `readonly \`0x${string}\`[]`(the`[...hashes, signature]`shape). The runtime assertion now
checks the trailing element is a`0x`-prefixed signature instead of validating a `.signature`
  field per item.
- `useCofheEncryptAndWriteContract`: the internal `encrypt` callback type updated to match;
  composes with the `@cofhe/abi` changes above via `extractEncryptableValues`/`insertEncryptedValues`.

## Test fixture contracts

- `test/setup/contracts/SimpleTest.sol` (shared by `hardhat-plugin-test`,
  `hardhat-3-plugin-test` and `integration-matrix`): added `setValueBatch`/
  `setPublicValueBatch`/`addValueBatch` — new canonical batch entry points, calling
  `FHE.asEuint32s(...)`. The single-value entry points
  `setValue`/`setPublicValue`/`setValueHashPlusProof`/`addValue` still take
  `(externalEuint32, bytes)` and are unchanged: since `FHE.asEuint32(hash, proof)` now verifies as
  a one-element batch, `encryptInputs()`'s output for a single input passes into them unchanged
  (covered by `encrypt-inputs.test.ts`). Because the fixture's bytecode changed, `pnpm test:setup`
  will redeploy it on every chain it targets.
- `packages/mock-contracts/contracts/ABITest.sol`: encrypted-input test fixtures migrated from
  `InEuintXX` struct parameters to `external*` + trailing `bytes` signature parameters.

## What this means for contract authors

If your contract's encrypted-input functions look like:

```solidity
function myFunction(InEuint32 memory value) external { ... }
// or
function myFunction(externalEuint32 hash, bytes calldata proof) external { ... }
```

`cofheClient.encryptInputs([...]).execute()`'s new output (`[hash, signature]`) is **not**
compatible with either of these — both expect a signature scoped to that single ciphertext,
and the SDK no longer produces one. You need a batch-shaped entry point instead, e.g.:

```solidity
function myFunction(externalEuint32[] calldata hashes, bytes calldata signature) external {
  euint32[] memory values = FHE.asEuint32s(hashes, signature);
  ...
}
```

(`FHE.asEuint32s` etc. are the new batch helpers from `cofhe-contracts#78`, currently only
available via the local patch described above.) For mixed-type batches, call
`ITaskManager.batchVerifyInputs` directly with the appropriate `UnsignedEncryptedInput[]`.

## Known temporary limitation

The live CoFHE verifier service does not implement the batch endpoint yet —
`cofheClient.encryptInputs(...).execute()` against a real chain fails with `ZK_VERIFY_FAILED`
until the server ships it. This is the cause of the currently-failing live tests in
`packages/sdk` (`node/test/tfheinit.test.ts`, `node/test/inherited.test.ts`,
`core/test/decrypt.test.ts` and their web counterparts). The hardhat-mocks path
(`MockTaskManager.batchVerifyInputs`) works end-to-end today and is covered by tests in
`test/hardhat-plugin-test` and `test/hardhat-3-plugin-test`. `test/integration-matrix` now
exercises `encryptInputs` (including against staging), so those suites will go green once the
endpoint ships.

The endpoint path is **`POST /verifyBatch`**, matching `zkVerifyBatch` in
`packages/sdk/core/encrypt/zkPackProveVerify.ts`. Only the deployment is outstanding; the path
itself is settled.

---

# Breaking change: encrypted inputs are now bound to a consuming contract

Follow-up to the batch migration above, implementing
[`FhenixProtocol/cofhe-contracts#77`](https://github.com/FhenixProtocol/cofhe-contracts/pull/77).

## Why

`TaskManager.verifyInput`/`batchVerifyInputs` previously signed
`keccak256(ctHash || utype || securityZone || sender || chainId)`. Since a signed input packet
travels in public calldata, an attacker could lift a victim's valid packet and replay it into a
_different_ contract than the one it was signed for — `verifyInput`/`batchVerifyInputs` are
permissionless and hand the caller a transient ACL allowance over the resulting handle. PR #77
closes this by folding the consuming contract (the caller of `FHE.asEuint*`/`FHE.asEuint*s`,
i.e. `msg.sender` as seen by the TaskManager) into the signed message:

```
keccak256(ctHash || utype || securityZone || sender || chainId || contractAddress)
```

Because the SDK/mocks compute this signature **off-chain, before** any transaction happens, the
caller must now declare in advance which contract will consume the result.

## `@cofhe/sdk`

- **New, required** `EncryptInputsBuilder.setConsumingContract(address)` /
  `.getConsumingContract()`. `execute()` throws `CofheErrorCode.ConsumingContractUninitialized`
  if it was never called — there is no default (e.g. falling back to `msg.sender` at execute
  time defeats the point: the caller must commit to the target contract before signing).
- **Changed** signature digest (mocks path, `cofheMocksZkVerifySign.ts`): now folds in the
  consuming contract per the formula above.
- **Changed** production request: `zkVerifyBatch` now sends a `contract_address` field to
  `POST /verifyBatch`, alongside the existing `account_addr`/`security_zone`/`chain_id`. This
  exact field name is confirmed against the real verifier service's `VerifyRequest` struct
  (`zee-k-verifier#37`, which added it to the legacy `/verify` endpoint) — `BATCH_SIGNATURE_CHANGES.md`
  predates PR #77 and doesn't document it for `/verifyBatch` specifically yet, so this assumes the
  batch endpoint will use the same field name once it ships. The live service does not yet deploy
  `/verifyBatch` (see "Known temporary limitation" above), so this has no observable effect until
  then.

## `@cofhe/mock-contracts`

- `MockTaskManager.sol`: `inputMessageHash`/`extractSigner`/`extractBatchSigner` now take an
  additional `contractAddress` parameter, folded into the digest exactly as above.
  `verifyInput`/`batchVerifyInputs`'s **external ABI is unchanged** — `contractAddress` is read
  from `msg.sender` inside the TaskManager (the immediate caller of these functions), not passed
  as an argument, matching PR #77 exactly.

## `@cofhe/foundry-plugin`

- **Changed signature**: every encryption helper takes a new final `address consumingContract`
  parameter — `createExternalEbool`, `createExternalEuint8`...`createExternalEuint128`, `createExternalEaddress`,
  `createEuint32sBatch`, and the internal `createEncryptedInputsBatch` root. There is no global
  setter; the caller passes it at each call site, e.g.
  `cofheClient.createExternalEuint32(42, address(myContract))`. Reverts with
  `'CofheClient: consuming contract must not be the zero address'` if `address(0)` is passed.
- `MockZkVerifierSigner.zkVerifyBatchSign` gained a required `contractAddress` parameter.
- Existing Foundry tests that create encrypted inputs now pass `address(targetContract)` as the
  last argument to every `createExternal*`/`createEuint32sBatch` call.

## `@cofhe/react`

- `EncryptionOptions`/`EncryptInputsOptions` (used by `useCofheEncrypt`) gained an optional
  `consumingContract` field, threaded through to `builder.setConsumingContract(...)`.
- `useCofheEncryptAndWriteContract` now defaults `consumingContract` to the write's target
  `address` automatically (the one call site in the repo where the consuming contract is
  already unambiguously known) — an explicit `encryptionOptions.consumingContract` still
  overrides this default.
