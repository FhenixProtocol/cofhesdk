# Contracts (Solidity)

`@cofhe/*` 0.7.1 depends on `@fhenixprotocol/cofhe-contracts` **0.2.0**, which removes the
single-item input path. Do this **before** touching TypeScript: the ABI you land on determines
what every call site must look like.

## What 0.2.0 deletes

| Deleted from   | Symbols                                                                                         |
| -------------- | ----------------------------------------------------------------------------------------------- |
| `ICofhe.sol`   | `struct InEbool`, `InEuint8`, `InEuint16`, `InEuint32`, `InEuint64`, `InEuint128`, `InEaddress` |
| `FHE.sol`      | `FHE.asEbool(InEbool)` … `FHE.asEaddress(InEaddress)` — the struct-taking overloads             |
| `ICofhe.sol`   | `Utils.inputFromEbool(...)` … `Utils.inputFromEaddress(...)`                                    |
| `ITaskManager` | `verifyInput(EncryptedInput, address)`                                                          |

Added: `struct UnsignedEncryptedInput { uint256 ctHash; uint8 securityZone; uint8 utype; }`,
`ITaskManager.batchVerifyInputs(UnsignedEncryptedInput[], address, bytes)`, and batch helpers
`FHE.asEbools` / `asEuint8s` / `asEuint16s` / `asEuint32s` / `asEuint64s` / `asEuint128s` /
`asEaddresses` (each with an `external*[]` and a `bytes[]` overload).

Also added in `0.2.0`: the `sharedEuintXX` family for passing encrypted values
between contracts. The cases below are about values arriving **from a user**; once they are done,
work through [shared-euints.md](shared-euints.md) for every value that crosses a **contract**
boundary. That pass is required too, and unlike everything on this page the compiler will not
surface it — the old spelling still builds.

## Find the affected functions

```bash
# Case A candidates - the deleted structs
grep -rnE '\bIn(Ebool|Euint8|Euint16|Euint32|Euint64|Euint128|Eaddress)\b' --include='*.sol' .

# Already on the external form - check how many encrypted params each takes
grep -rnE '\bexternal(Ebool|Euint8|Euint16|Euint32|Euint64|Euint128|Eaddress)\b' --include='*.sol' .
```

Then classify each function by the two questions that decide everything:
**(1) which shape does it use now, and (2) how many encrypted parameters does it take?**

### Sizing the job in one compile

`solc` and `hardhat compile` stop at the **first** unresolved import, so you cannot enumerate the
work by compiling — you fix one error and get the next. To see the whole blast radius at once, in a
**scratch copy that is never committed**, re-declare the deleted struct and repoint the imports at
it, then compile:

```solidity
// scratch copy only
struct InEuint64 { uint256 ctHash; uint8 securityZone; uint8 utype; bytes signature; }
```

Every other 0.2.0 incompatibility surfaces together, with no ABI decisions made yet. Knowing the
exposure up front is what makes it safe to script the change rather than hand-edit each signature.

---

## Case A — uses `InEuintXX` (most 0.6.x contracts) → must change

The 0.6.x docs taught this shape, so expect it to be the common starting point. It no longer
compiles.

```solidity
// BEFORE
function setValue(InEuint32 memory inValue) public {
  _setStoredValue(FHE.asEuint32(inValue));   // struct carried its own signature
}
```

```solidity
// AFTER - one encrypted value
function setValue(externalEuint32 inValue, bytes memory proof) public {
  _setStoredValue(FHE.asEuint32(inValue, proof));
}
```

The signature moves out of the struct into a `bytes` parameter immediately after the `external*`
handle. Extra non-encrypted arguments can follow that pair. **Requires a redeploy.**

`InEuintXX memory` and `InEuintXX calldata` both occur — the examples here show `memory`, but a
rewrite keyed on that spelling silently skips the `calldata` ones. The detection greps match the
bare type name and catch both; the transformation must too.

> **Linked libraries need more than a redeploy.** If the changed code lives in an external library
> that consumers link **by address**, the library gets a new address, **every host must be relinked
> and redeployed**, and any reproducible-bytecode or explorer-verification arrangement resets to a
> new baseline. Libraries deployed before the migration are not interchangeable with the new one.

If the function takes more than one encrypted value, go to Case C instead.

---

## Case B — already `(externalEuint32, bytes)` with exactly one encrypted value → no change

```solidity
// BEFORE and AFTER are identical
function setValue(externalEuint32 inValue, bytes memory proof) public {
  _setStoredValue(FHE.asEuint32(inValue, proof));
}
```

`FHE.asEuint32(hash, proof)` still exists in 0.2.0, but now wraps the input into a one-element
batch and calls `batchVerifyInputs`. So `proof` must be a **batch signature over a one-item
batch** — which is exactly what `encryptInputs()` produces for a single input. No redeploy.

Only the caller changes (see [encrypt-inputs.md](encrypt-inputs.md)).

> A contract keeping this shape compiles cleanly and **reverts at runtime** if handed a legacy
> per-item signature. That only matters if something other than the current SDK is producing
> signatures.

---

## Case C — two or more encrypted values in one function → must change

```solidity
// BEFORE
function transfer(address to, InEuint32 memory amount, InEuint32 memory fee) public { ... }
```

```solidity
// AFTER
function transfer(address to, externalEuint32[] calldata values, bytes calldata signature) public {
  euint32[] memory v = FHE.asEuint32s(values, signature);
  euint32 amount = v[0];
  euint32 fee    = v[1];
  ...
}
```

You **cannot** keep two `(hash, proof)` pairs. The signature covers
`keccak256(h_amount ‖ h_fee)`; calling `FHE.asEuint32(h_amount, sig)` verifies it against
`keccak256(h_amount)` alone and reverts.

**Ask the developer before doing this.** Named parameters collapse into array indices, which
changes how every caller reads. The ordering is a design decision, not a mechanical one.

### Keeping the names

The array is not forced. What is forced is **one signature covering all the hashes** — the handles
can stay as separate named parameters, assembled into the array inside the function:

```solidity
function transfer(
  address to,
  externalEuint32 amount,
  externalEuint32 fee,
  bytes calldata signature
) public {
  externalEuint32[] memory packed = new externalEuint32[](2);
  packed[0] = amount;
  packed[1] = fee;
  euint32[] memory v = FHE.asEuint32s(packed, signature);
  // v[0] is amount, v[1] is fee
}
```

Same signature, same verification, readable call sites. It costs a few lines of assembly in the
function body and keeps the ABI self-documenting. Offer this alongside the array form — most
projects that resist Case C are resisting the loss of names, not the batching.

### Mixed types in one batch

There is no single typed array for a `euint32` plus an `ebool`. Call `batchVerifyInputs` directly:

```solidity
UnsignedEncryptedInput[] memory inputs = new UnsignedEncryptedInput[](2);
inputs[0] = UnsignedEncryptedInput(uint256(externalEuint32.unwrap(amountHash)), 0, Utils.EUINT32_TFHE);
inputs[1] = UnsignedEncryptedInput(uint256(externalEbool.unwrap(flagHash)),     0, Utils.EBOOL_TFHE);
uint256[] memory handles = ITaskManager(TASK_MANAGER_ADDRESS).batchVerifyInputs(inputs, msg.sender, signature);
```

---

## The proof-follows-hash rule

The batch signature does **not** have to be the function's last parameter. It has to immediately
follow the `external*` handle it authenticates — `FHE.asEuintXX(hash, proof)` is a pair, not a
trailing slot.

Extra non-encrypted arguments after that pair are fine. ERC-7984's `*AndCall` overloads are the
canonical example — and this is the shape `fhenix-confidential-contracts` 0.4.0 actually ships:

```solidity
function confidentialTransferAndCall(
  address to,
  externalEuint64 encryptedAmount,
  bytes calldata inputProof,
  bytes calldata data
) external returns (sharedEuint64 transferred);

function confidentialTransferFromAndCall(
  address from,
  address to,
  externalEuint64 encryptedAmount,
  bytes calldata inputProof,
  bytes calldata data
) external returns (sharedEuint64 transferred);
```

Do **not** move `inputProof` to the last slot to please TypeScript helpers. Match that pairing.

The `sharedEuint64` return is the other half of the same migration — see
[shared-euints.md](shared-euints.md) for why, and
[confidential-tokens.md](confidential-tokens.md) if the project actually depends on that library
rather than merely resembling it.

`@cofhe/abi` (`extractEncryptableValues` / `insertEncryptedValues`, and
`useCofheEncryptAndWriteContract`) follows the same rule: it takes the `bytes` immediately after the
contiguous run of `external*` parameters as the signature slot, so ERC-7984-style `*AndCall` wires
up automatically. The one shape it rejects is `external*` parameters that are **not adjacent** to
each other — they share a single signature, so there is no unambiguous slot to pair them with.

## Verify

```bash
forge build            # or: npx hardhat compile
```

Zero references to `InEuint*` should remain. Then redeploy anything in Case A or C and update the
addresses your client code uses.

A clean build here does **not** mean the contract work is finished — see
[shared-euints.md](shared-euints.md).
