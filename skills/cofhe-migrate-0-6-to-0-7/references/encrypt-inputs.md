# Encrypt call sites

Two changes land on the same call sites, so do them in one pass: the **return shape** of
`execute()`, and the newly required **consuming contract**.

## What `execute()` returns now

`EncryptInputsBuilder.execute()` used to return one `EncryptedItemInput` struct per value, each
carrying its own signature. It now returns `[...hashes, signature]` — one ciphertext hash per
input, in order, followed by a single signature that authenticates the whole batch.

```ts
// BEFORE
const [encA, encB] = await client.encryptInputs([a, b]).execute();
encA.ctHash; // bigint
encA.signature; // this value's own signature
await contract.f(encA, encB);

// AFTER
const [hashA, hashB, signature] = await client.encryptInputs([a, b]).setConsumingContract(contractAddress).execute();
await contract.f([hashA, hashB], signature);
```

Note the result is `inputs.length + 1` elements. Code that assumed `result.length === inputs.length`
is off by one.

## `setConsumingContract` is required

The verifier binds the consuming contract into the signed digest, so a batch signed for one
contract cannot be replayed into another. You must declare the target **before** signing.

Omitting it is a compile error: `client.encryptInputs(...)` returns `EncryptInputsBuilderUnset<T>`,
which has no `execute()` method. `setConsumingContract(address)` returns the builder that does.

```
Property 'execute' does not exist on type 'EncryptInputsBuilderUnset<[...]>'
```

The address is the contract whose function will pass the values into `FHE.asEuint*` — i.e. the
contract you are about to call, not the user's wallet.

Chainable setters (`setAccount`, `setChainId`, `setSecurityZone`, `setUseWorker`, `onStep`)
preserve whichever state they are called on, so order doesn't matter:

```ts
await client
  .encryptInputs([a])
  .setAccount(account)
  .setConsumingContract(addr) // anywhere before .execute()
  .onStep(cb)
  .execute();
```

JavaScript callers get no type check and will hit a `ConsumingContractUninitialized` throw at
`execute()` instead.

## Removed types

All of these are gone. If they appear in an annotation, the value is now `` `0x${string}` `` (a
hash) or ``readonly `0x${string}`[]`` (the whole result).

`EncryptedItemInput`, `EncryptedBoolInput`, `EncryptedUint8Input`, `EncryptedUint16Input`,
`EncryptedUint32Input`, `EncryptedUint64Input`, `EncryptedUint128Input`, `EncryptedAddressInput`,
`EncryptedItemInputs<T>`, `EncryptableToEncryptedItemInputMap`, `assertCorrectEncryptedItemInput`.

Also removed: `EncryptInputsBuilder.asHashPlusProof()` — its output is what `execute()` always
returns now, so delete the call. `EncryptInputsBuilder<T, HPP>` takes a single type parameter.

```ts
// BEFORE
const r = await client.encryptInputs([a]).asHashPlusProof().execute();
// AFTER
const r = await client.encryptInputs([a]).setConsumingContract(addr).execute();
```

Internal HTTP clients `zkVerify` / `VerifyResult` / `VerifyResultRaw` are replaced by
`zkVerifyBatch` / `VerifyBatchResult` / `VerifyBatchResultRaw` / `VerifyBatchOutputRaw`.

## Find them

```bash
grep -rnE '\.encryptInputs\(|asHashPlusProof|EncryptedItemInput|Encrypted(Bool|Uint8|Uint16|Uint32|Uint64|Uint128|Address)Input' \
  --include='*.ts' --include='*.tsx' .
```

## Stop and ask

- **Persisted results.** If `EncryptedItemInput` values were written to a database, queue, or
  local storage, they carry per-item signatures that cannot be regenerated from a batch
  signature. This is a data migration, not a code change.
- **Split producer/consumer.** If encryption happens in one place and the contract call in
  another, the batch signature now ties every hash in it to one contract address, which must be
  known at encryption time.
- **One value reused against two contracts.** No longer possible with a single encryption — it
  needs one batch per target contract.

## Verify

`tsc --noEmit` should be clean. Then check that array destructuring accounts for the trailing
signature — a wrong-length destructure typechecks fine and fails at runtime.
