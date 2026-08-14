# Verification

Run these in order — each one's failures are noise until the previous passes.

## 1. Contracts compile

```bash
forge build      # or: npx hardhat compile
```

Zero references to `InEuint*` should remain. If any survive, [contracts.md](contracts.md) Case A is incomplete.

## 2. Types

```bash
npx tsc --noEmit
```

Expect zero errors. Common leftovers and what they mean:

| Error                                                                        | Cause                                                                         |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `Property 'execute' does not exist on type 'EncryptInputsBuilderUnset<...>'` | missing `.setConsumingContract(...)` — [encrypt-inputs.md](encrypt-inputs.md) |
| `'Permit' is not exported` / `Module '"@cofhe/sdk/permits"' not found`       | rename sweep incomplete — [acp-rename.md](acp-rename.md)                      |
| `'EncryptedItemInput' is not exported`                                       | removed type still annotated — [encrypt-inputs.md](encrypt-inputs.md)         |
| `Property 'permits' does not exist`                                          | `client.permits` → `client.acp` (singular)                                    |

## 3. Residual-name sweep

The compiler cannot catch string literals or comments.

```bash
# old error-code strings - compares silently keep working and silently never match
grep -rnE "'PERMIT_[A-Z_]+'|\"PERMIT_[A-Z_]+\"|permit_(malformed|denied|expired|invalid|required)" \
  --include='*.ts' --include='*.tsx' .

# stale config keys
grep -rnE 'defaultPermitExpiration|shareablePermits|autogeneratePermits|permitExpirationOptions|defaultPermitExpirationSeconds' \
  --include='*.ts' --include='*.tsx' .

# removed foundry helpers
grep -rnE 'createIn(Ebool|Euint)|_asHashPlusProof|zkVerifySign' --include='*.sol' .
```

## 4. Build and test

```bash
npm run build && npm test      # adapt to the project's scripts
```

## 5. Checks the tooling cannot make

Go through these with the developer:

- [ ] **Array destructuring accounts for the trailing signature.** `execute()` returns
      `inputs.length + 1` elements. A wrong-length destructure typechecks and fails at runtime.
- [ ] **Contracts redeployed** and client-side addresses updated, for anything in Case A or C.
- [ ] **Consuming contract is the right address** at each encrypt site — the contract that will
      call `FHE.asEuint*`, not the user's wallet, and not a proxy's implementation.
- [ ] **Users will be prompted to re-sign.** The ACP store was wiped; previously stored permits
      cannot verify. Expected, not data loss.
- [ ] **Revocation no longer has a distinct wire code** — it arrives as `acp_denied`.
- [ ] **Mock stack wires up `ACPTimestampRevoker` and `ACPShareRegistry`**, if the project
      deploys mocks itself.

## Expected failure: `ZK_VERIFY_FAILED` on a live chain

The CoFHE verifier's batch endpoint is not deployed yet. Encryption against a **real chain** fails
with `ZK_VERIFY_FAILED` regardless of whether the migration is correct.

**Tell the developer this before they debug it.** Right now, "did my migration work?" can only be
answered against hardhat mocks. Once the endpoint ships, live encryption starts working with no
further code changes.

## Final report

- what changed, by area
- what was skipped, and why
- what still needs a human decision (Case C ABI shapes, persisted encrypted values, third-party
  contracts)
- verification results
- the `ZK_VERIFY_FAILED` caveat, if the project targets a live chain
