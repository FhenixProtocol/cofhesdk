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

## 4. Build and test — every runner the project has

A green `forge build` is not a pass. Neither is one test suite. Run all of these:

```bash
forge build && forge test              # if the project uses Foundry
npx hardhat compile && npx hardhat test # if the project uses Hardhat
npx tsc --noEmit                        # must include test files, not just src
npm run build && npm test               # adapt to the project's scripts
```

A repo with both runners will have **different** failures in each — Foundry catches the Solidity
and helper renames, Hardhat catches the selector strings and EOA-share breakage
([tests.md](tests.md)).

## 4b. Re-run the greps

The compiler cannot see any of these, so do them last, when the code is otherwise green:

```bash
grep -rnE '\bIn(Ebool|Euint8|Euint16|Euint32|Euint64|Euint128|Eaddress)\b' --include='*.sol' .
grep -rn  'allowTransient' --include='*.sol' .
grep -rnE 'createIn(Ebool|Euint)|_asHashPlusProof|zkVerifySign' --include='*.sol' .
grep -rnE 'withoutPermit|withPermit|decryptForTx_with' --include='*.ts' --include='*.sol' .
grep -rnE '\(uint256,uint8,uint8,bytes\)' --include='*.ts' --include='*.tsx' .
```

Every remaining hit is either unfinished work or a deliberate skip. There is no third category —
if it is deliberate, it belongs in the report.

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

## 5b. Behaviour changes with no compile error

These compile clean after a faithful rename and break at runtime. Check each explicitly:

- [ ] **`ACPUtils.export()` throws for non-sharing and unsigned ACPs.** 0.6 never threw. A bare
      `export(acp)` on a self ACP — especially during render — now throws every time. Gate on
      `acp.type === 'sharing'`.
- [ ] **String _values_ behind renamed const-map members changed** (`'missing-permit'` →
      `'missing-acp'`, `'open-permits'` → `'open-acps'`). Compiler-invisible. Anything that
      persisted, keyed, or transmitted one of these breaks silently — see
      [react.md](react.md).
- [ ] **Error classification by prefix or substring.** `startsWith('permit')` /
      `includes('permit_…')` against a lowercased wire token matches no rename and silently
      stops classifying.
- [ ] **Anything that inspects the request body.** The decrypt request carries `acp`, not
      `permit`. A fault injector, proxy, recorder, or test assertion reading `body.permit`
      through a cast no-ops with zero errors.

## Expected failure: `ZK_VERIFY_FAILED` on the public testnets

The verifier's batch endpoint is live on **CoFHE staging** and the host chain, and encryption works
end-to-end there and against hardhat mocks. It is **not yet deployed on the public testnets**
(Sepolia, Arbitrum Sepolia, Base Sepolia), where encryption fails with `ZK_VERIFY_FAILED` regardless
of whether the migration is correct.

**Tell the developer this before they debug it.** Point a run at staging to confirm the migration is
correct; the testnets start working with no further code changes once the endpoint ships there.

## Final report

- what changed, by area
- what was skipped, and why
- what still needs a human decision (Case C ABI shapes, persisted encrypted values, third-party
  contracts)
- verification results
- the `ZK_VERIFY_FAILED` caveat, if the project targets a live chain
