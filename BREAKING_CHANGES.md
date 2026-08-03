# Breaking changes: migration to batch input verification

This document logs the breaking changes made while migrating `cofheClient.encryptInputs`
(and everything built on top of it) from the legacy **one-signature-per-ciphertext**
verification scheme to the new **one-signature-per-batch** scheme described in
`BATCH_SIGNATURE_CHANGES.md` (`POST /verify-batch`) and implemented on-chain by
[`FhenixProtocol/cofhe-contracts#78`](https://github.com/FhenixProtocol/cofhe-contracts/pull/78).

**There is no backwards-compatibility shim.** A single batch signature cannot be split
back into N valid per-item signatures, so the old output shape is gone, not deprecated.

---

## Why

`cofheClient.encryptInputs(...).execute()` used to return an array of `EncryptedItemInput`
structs — one **valid signature per ciphertext**. The new `/verify-batch` endpoint (and the
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
  the `/verify-batch` HTTP client.
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

## `@fhenixprotocol/cofhe-contracts` (external dependency — temporary patch)

`FhenixProtocol/cofhe-contracts#78` is **not yet published to npm** (latest published version
is `0.1.4`; the PR is open, unmerged, as of this migration). To develop and test against the
new batch scheme now, the installed package is **patched in place** via `pnpm patch`
(`patches/@fhenixprotocol__cofhe-contracts@0.1.4.patch`, applied automatically on `pnpm install`
via the `pnpm.patchedDependencies` entry in the root `package.json`). See `patches/README.md`
for full details of what's patched and — importantly — **removal instructions**: once
`cofhe-contracts` publishes PR #78, bump the pinned dependency in `packages/mock-contracts`,
`packages/foundry-plugin`, and `test/setup`, and delete the patch entirely.

Patched additions (mirroring the PR exactly):

- `ICofhe.sol`: new `BatchedEncryptedInput` struct (`{ctHash, securityZone, utype}`, no
  per-item signature); `ITaskManager.verifyInput` gains an explicit `bytes signature`
  parameter (moved out of `EncryptedInput`); new
  `ITaskManager.batchVerifyInputs(BatchedEncryptedInput[], address, bytes)`.
- `FHE.sol`: `Impl.verifyInput`/`Impl.verifyBatchInputs` plumbing; every `asE*` overload now
  passes its signature explicitly; new batch helpers `asEbools`, `asEuint8s`, `asEuint16s`,
  `asEuint32s`, `asEuint64s`, `asEuint128s`, `asEaddresses` (each with an `external*[]` and a
  `bytes[]` overload).

**The legacy single-item `InEuintXX` structs and `verifyInput`/single-item `asE*(hash, proof)`
overloads are unchanged and still valid** — real chains keep supporting them. Only
`cofheClient.encryptInputs()`'s own output changed; contracts still written against the
single-item ABI shape continue to work for anyone calling them directly (just not via the
SDK's `encryptInputs()` anymore, since it can no longer produce a valid single-item struct or
single-item hash+proof pair — see below).

## `@cofhe/mock-contracts`

- `MockTaskManager.verifyInput`: signature changed from `(EncryptedInput, address)` to
  `(EncryptedInput, address, bytes signature)`, matching the patched `ITaskManager`. Still
  present for interface conformance / anyone exercising the legacy single-item path directly —
  no longer called by anything in this repo's own tooling.
- **Added** `MockTaskManager.batchVerifyInputs(BatchedEncryptedInput[], address, bytes)` — the
  canonical verification path used everywhere in this repo going forward, including for
  single-item batches (n=1).
- ABI/typechain artifacts (`packages/mock-contracts/abi/*.json`, `src/*.ts`,
  `src/typechain-types/*`) regenerated to reflect the above.

## `@cofhe/foundry-plugin`

- **Removed** `MockZkVerifierSigner.zkVerifySignPacked` — it was a "fake batch": a loop
  producing N independent per-item signatures, not a real batch signature. Replaced by
  **`MockZkVerifierSigner.zkVerifyBatchSign`**, a genuine batch signer (one signature over
  `keccak256(h_0 || ... || h_n)`).
- **`CofheClient.createEncryptedInputsBatch` is now the root of every encryption helper on the
  client**, single-item or not. `createInEbool`...`createInEaddress` no longer sign via the
  legacy single-item digest — they call `createEncryptedInputsBatch` with a batch of size 1 and
  unwrap the result, so their returned `(hash, proof)` is a **batch signature**, not a legacy
  single-item signature.
  - **Breaking for consumers of these helpers**: the returned signature no longer verifies
    against the legacy single-item path (`FHE.asEuint32(hash, proof)` /
    `MockTaskManager.verifyInput`/`extractSigner`) — it only verifies via the batch path
    (`FHE.asEuint32s([hash], signature)` / `MockTaskManager.batchVerifyInputs`). Test contracts
    consuming these helpers must expose a batch-shaped entry point (see
    `EncryptedValueStore.storeEuint32Batch` etc. in `test/CofhePlugin.t.sol`, or
    `SimpleTest.setValueBatch` in `test/setup/contracts/SimpleTest.sol`).
  - **Removed** `MockZkVerifierSigner.zkVerifySign` (the legacy single-item signer) — nothing
    in this repo's own tooling produces legacy single-item signatures anymore. The on-chain
    `MockTaskManager.verifyInput`/`extractSigner` (the legacy single-item verifier) is
    unchanged and still present for interface conformance / real-chain compatibility, but
    there's no longer a Foundry-side helper to produce a matching signature for it.
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

- `test/setup/contracts/SimpleTest.sol` (shared by `hardhat-plugin-test` and
  `hardhat-3-plugin-test`): added `setValueBatch`/`setPublicValueBatch` — new canonical batch
  entry points, calling `FHE.asEuint32s(...)`. `setValue`/`setPublicValue`/
  `setValueHashPlusProof` (legacy single-item entry points) are unchanged and still valid, but
  **`encryptInputs()`'s new output can no longer be passed into them directly** — see below.
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
`ITaskManager.batchVerifyInputs` directly with the appropriate `BatchedEncryptedInput[]`.

## Known temporary limitation

The live CoFHE verifier service does not implement `/verify-batch` yet at the time of this
migration — `cofheClient.encryptInputs(...).execute()` against a real chain will fail with
`ZK_VERIFY_FAILED` until the server ships the endpoint. The hardhat-mocks path
(`MockTaskManager.batchVerifyInputs`) works end-to-end today and is covered by tests in
`test/hardhat-plugin-test` and `test/hardhat-3-plugin-test`. `test/integration-matrix` (which
exercises live CoFHE infrastructure) was intentionally left out of this migration for the same
reason.

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
  `POST /verify-batch`, alongside the existing `account_addr`/`security_zone`/`chain_id`. This
  exact field name is confirmed against the real verifier service's `VerifyRequest` struct
  (`zee-k-verifier#37`, which added it to the legacy `/verify` endpoint) — `BATCH_SIGNATURE_CHANGES.md`
  predates PR #77 and doesn't document it for `/verify-batch` specifically yet, so this assumes the
  batch endpoint will use the same field name once it ships. The live service does not yet implement
  `/verify-batch` at all (see "Known temporary limitation" above), so this has no observable
  effect until then.

## `@cofhe/mock-contracts`

- `MockTaskManager.sol`: `inputMessageHash`/`extractSigner`/`extractBatchSigner` now take an
  additional `contractAddress` parameter, folded into the digest exactly as above.
  `verifyInput`/`batchVerifyInputs`'s **external ABI is unchanged** — `contractAddress` is read
  from `msg.sender` inside the TaskManager (the immediate caller of these functions), not passed
  as an argument, matching PR #77 exactly.

## `@cofhe/foundry-plugin`

- **New, required** `CofheClient.setConsumingContract(address)` — mirrors the SDK builder.
  `createEncryptedInputsBatch` (the root of every `createIn*`/`createEncryptedInputsBatch`/
  `createEuint32sBatch` helper) now reverts with `'CofheClient: consuming contract not set'` if
  it was never called.
- `MockZkVerifierSigner.zkVerifyBatchSign` gained a required `contractAddress` parameter.
- Existing Foundry tests that create encrypted inputs must call
  `cofheClient.setConsumingContract(address(targetContract))` once (typically in `setUp()`)
  before creating any encrypted input.

## `@cofhe/react`

- `EncryptInputsOptions` (used by `useCofheEncrypt`) gained an optional `consumingContract`
  field, threaded through to `builder.setConsumingContract(...)`.
- `useCofheEncryptAndWriteContract` now defaults `consumingContract` to the write's target
  `address` automatically (the one call site in the repo where the consuming contract is
  already unambiguously known) — an explicit `encryptionOptions.consumingContract` still
  overrides this default.
