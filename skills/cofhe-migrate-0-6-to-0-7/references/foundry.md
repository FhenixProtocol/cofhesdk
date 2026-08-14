# @cofhe/foundry-plugin

Solidity-side test helpers. Read [contracts.md](contracts.md) first — the ABI decisions there determine what
these calls must produce.

## Helper renames

`createIn*` → `createExternal*`. The old names described a return of `InEuintXX` **structs**;
these now return an `external*` handle plus a batch signature, so the names follow the types.

| Before                | After                                          |
| --------------------- | ---------------------------------------------- |
| `createInEbool(v)`    | `createExternalEbool(v, consumingContract)`    |
| `createInEuint8(v)`   | `createExternalEuint8(v, consumingContract)`   |
| `createInEuint16(v)`  | `createExternalEuint16(v, consumingContract)`  |
| `createInEuint32(v)`  | `createExternalEuint32(v, consumingContract)`  |
| `createInEuint64(v)`  | `createExternalEuint64(v, consumingContract)`  |
| `createInEuint128(v)` | `createExternalEuint128(v, consumingContract)` |
| `createInEaddress(v)` | `createExternalEaddress(v, consumingContract)` |

**Removed with no replacement:** the `createIn*_asHashPlusProof` variants (there is exactly one
helper per type now), `createEncryptedInput`, `MockZkVerifierSigner.zkVerifySign`, and
`MockZkVerifierSigner.zkVerifySignPacked` (which was a fake batch — a loop of N independent
per-item signatures, not one signature over the batch).

Also renamed: `createBasePermission()` → `createBaseACP()`, returning an `ACP` struct.

## Every helper takes a consuming contract

There is no global setter; pass it at each call site. Reverts with
`'CofheClient: consuming contract must not be the zero address'` on `address(0)`.

```solidity
// BEFORE
InEuint32 memory input = cofheClient.createInEuint32(42);
myContract.setValue(input);

// AFTER - single value
(externalEuint32 hash, bytes memory proof) =
  cofheClient.createExternalEuint32(42, address(myContract));
myContract.setValue(hash, proof);
```

## Batch helpers

```solidity
// typed convenience wrapper
(externalEuint32[] memory hashes, bytes memory signature) =
  cofheClient.createEuint32sBatch(values, address(myContract));
myContract.setValueBatch(hashes, signature);
```

`createEncryptedInputsBatch(utypes, values, consumingContract)` is the generic, mixed-utype root —
every other helper now goes through it, including single-value ones (as a batch of size 1).

`MockZkVerifierSigner.zkVerifyBatchSign` replaces the removed signers and takes a
`contractAddress` parameter.

## Signatures are batch signatures now

Because `createExternal*` unwraps a batch of size 1, the `(hash, proof)` it returns is a **batch
signature**. It verifies through `FHE.asEuint32(hash, proof)` — which routes through
`batchVerifyInputs` as a one-element batch in cofhe-contracts 0.2.x — and through
`FHE.asEuint32s([hash], sig)`.

It does **not** verify against a legacy per-item verifier. `MockTaskManager.verifyInput` and
`extractSigner` were removed along with `ITaskManager.verifyInput`, so there is nothing left that
would accept one.

## Find them

```bash
grep -rnE 'createIn(Ebool|Euint8|Euint16|Euint32|Euint64|Euint128|Eaddress)|_asHashPlusProof|zkVerifySign(Packed)?|createEncryptedInput\b|createBasePermission' \
  --include='*.sol' .
```

## Verify

```bash
forge test
```
