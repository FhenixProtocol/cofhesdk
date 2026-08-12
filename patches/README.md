# Patches

## `@fhenixprotocol/cofhe-contracts@0.1.4.patch`

**Temporary.** Vendors the contract changes from
[`FhenixProtocol/cofhe-contracts#78`](https://github.com/FhenixProtocol/cofhe-contracts/pull/78)
("Batch input verification with a single signature") on top of the latest
published version of the package (`0.1.4`), since that PR is not yet merged
upstream / published to npm.

Adds to `ICofhe.sol`:

- `BatchedEncryptedInput` struct (like `EncryptedInput`, minus the per-item `signature` field).
- `ITaskManager.verifyInput` gains an explicit `bytes memory signature` parameter (moved out of `EncryptedInput`).
- `ITaskManager.batchVerifyInputs(BatchedEncryptedInput[], address, bytes)` — one signature over `keccak256(h_0 || ... || h_n)` authenticates the whole batch.
- `Utils.batchInputEntryFromBytes` / `Utils.batchInputsFromBytes`.

Adds to `FHE.sol`:

- `Impl.verifyInput`/`Impl.verifyBatchInputs` plumbing for the above.
- Every `asE*(InE*/bytes/hash+proof)` overload now passes its signature explicitly.
- New batch helpers: `asEbools`, `asEuint8s`, `asEuint16s`, `asEuint32s`, `asEuint64s`, `asEuint128s`, `asEaddresses` (each with an `external*[]` and a `bytes[]` overload), authenticated by one shared signature.

**Remove this patch once `@fhenixprotocol/cofhe-contracts` publishes PR #78**:
bump the pinned dependency version in `packages/mock-contracts`,
`packages/foundry-plugin`, and `test/setup` to the version that includes it,
delete this patch file, and remove the `patchedDependencies` entry from the
root `package.json`.
