# Contracts (Solidity)

`@cofhe/*` 0.7.0 depends on `@fhenixprotocol/cofhe-contracts` **0.2.x**, which removes the
single-item input path. Do this **before** touching TypeScript: the ABI you land on determines
what every call site must look like.

## What 0.2.x deletes

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

## Find the affected functions

```bash
# Case A candidates - the deleted structs
grep -rnE '\bIn(Ebool|Euint8|Euint16|Euint32|Euint64|Euint128|Eaddress)\b' --include='*.sol' .

# Already on the external form - check how many encrypted params each takes
grep -rnE '\bexternal(Ebool|Euint8|Euint16|Euint32|Euint64|Euint128|Eaddress)\b' --include='*.sol' .
```

Then classify each function by the two questions that decide everything:
**(1) which shape does it use now, and (2) how many encrypted parameters does it take?**

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

The signature moves out of the struct into a trailing `bytes` parameter. **Requires a redeploy.**

If the function takes more than one encrypted value, go to Case C instead.

---

## Case B — already `(externalEuint32, bytes)` with exactly one encrypted value → no change

```solidity
// BEFORE and AFTER are identical
function setValue(externalEuint32 inValue, bytes memory proof) public {
  _setStoredValue(FHE.asEuint32(inValue, proof));
}
```

`FHE.asEuint32(hash, proof)` still exists in 0.2.x, but now wraps the input into a one-element
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

### Mixed types in one batch

There is no single typed array for a `euint32` plus an `ebool`. Call `batchVerifyInputs` directly:

```solidity
UnsignedEncryptedInput[] memory inputs = new UnsignedEncryptedInput[](2);
inputs[0] = UnsignedEncryptedInput(uint256(externalEuint32.unwrap(amountHash)), 0, Utils.EUINT32_TFHE);
inputs[1] = UnsignedEncryptedInput(uint256(externalEbool.unwrap(flagHash)),     0, Utils.EBOOL_TFHE);
uint256[] memory handles = ITaskManager(TASK_MANAGER_ADDRESS).batchVerifyInputs(inputs, msg.sender, signature);
```

---

## The trailing-`bytes` rule

`@cofhe/abi` (used by `useCofheEncryptAndWriteContract` and the ABI helpers) requires that **any
function with `external*` inputs has a plain `bytes` as its last parameter** — the slot the shared
batch signature goes into. `extractEncryptableValues` / `insertEncryptedValues` throw otherwise.

If you put the signature anywhere but last, the TypeScript helpers will reject the ABI even
though the contract compiles.

## Verify

```bash
forge build            # or: npx hardhat compile
```

Zero references to `InEuint*` should remain. Then redeploy anything in Case A or C and update the
addresses your client code uses.
