---
name: migrate-to-acp
description: >-
  Migrates a consumer app (React/TS and its Solidity) from a pre-ACP `@cofhe/*` release —
  anything before the ACP era: `0.5.x`, or alphas up to and including `0.0.0-alpha-202608111*` —
  to the current ACP-era SDK. Covers the five breaking waves in that window: stable error codes,
  consuming-contract binding on encrypted inputs, batch input verification, ACP (Permit V3) with
  scopes/revocation/on-chain sharing, and the Permit → ACP rename. Invoked as `/migrate-to-acp`,
  optionally with a target version, e.g. `/migrate-to-acp 0.0.0-alpha-20260814111818`.
disable-model-invocation: true
---

# Migrate to ACP

Upgrades a codebase that consumes `@cofhe/sdk` / `@cofhe/react` / `@cofhe/mock-contracts` /
`@cofhe/hardhat-plugin` / `@cofhe/foundry-plugin` across the ACP-era breaking changes.

**Roughly half of these breakages are invisible to the TypeScript compiler.** A clean `typecheck`
after the version bump does NOT mean the migration is done — steps 4 and 5 below are the ones that
fail at runtime, in production, on a user's first encrypt or decrypt.

---

## Step 0 — Preflight: is the target deployment ACP-era? (BLOCKING)

The new SDK refuses to sign for chains whose ACL predates ACP, and its encrypted inputs only verify
against a batch-capable zk-verifier. **If the chain/backends you target are not upgraded yet, stop —
this migration cannot ship**, no matter how clean the code changes are.

For every chain the app supports, resolve the ACL from the TaskManager and read its EIP-712 domain:

```bash
ACL=$(cast call <TASK_MANAGER_ADDRESS> "acl()(address)" --rpc-url <RPC>)
cast call $ACL "eip712Domain()(bytes1,string,string,uint256,address,bytes32,uint256[])" --rpc-url <RPC>
```

- Domain version **`"2"`** → ACP-era. Proceed.
- Domain version **`"1"`** → pre-ACP. The SDK throws at ACP-signing time with an explicit
  unsupported-chain error. Coordinate with the protocol team before continuing.

Also confirm with the protocol team that the chain's **zk-verifier** serves batch verification and
that its **key/CRS service matches the verifier build** — a mismatch surfaces as
`could not verify packed list` on every encrypt, which looks like a client bug but is not.

If the deployment exposes an ACP share registry, `acl.shareRegistry()` returns a non-zero address;
a zero address means on-chain sharing (step 6) is unavailable there.

---

## Step 1 — Bump every `@cofhe/*` dependency together

Find every manifest that pins a `@cofhe/*` package — in a monorepo these drift apart, and mixed
versions produce baffling type errors:

```bash
grep -rn "@cofhe/" --include=package.json . | grep -v node_modules
```

Set **all** of them to the same target version, then install. Ask the user for the target version if
none was passed to the skill; otherwise use the latest published alpha.

Remember `contracts/`-style packages: they usually pin `@cofhe/hardhat-plugin`,
`@cofhe/mock-contracts` and `@cofhe/sdk` too, often at an older release line than the app.

---

## Step 2 — Mechanical renames (the compiler finds these)

Run `pnpm typecheck` (or `tsc --noEmit`) and work the errors. The full mapping:

| Before                                                                                                                                 | After                                                      |
| -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `@cofhe/sdk/permits`                                                                                                                   | `@cofhe/sdk/acps`                                          |
| `client.permits.*`                                                                                                                     | `client.acp.*`                                             |
| `useCofheActivePermit`                                                                                                                 | `useCofheActiveACP`                                        |
| `useCofheAllPermits`                                                                                                                   | `useCofheAllACPs`                                          |
| `useCofhePermits`                                                                                                                      | `useCofheACPs`                                             |
| `useCofheCreatePermit`                                                                                                                 | `useCofheCreateACP`                                        |
| `useCofheSelectPermit`                                                                                                                 | `useCofheSelectACP`                                        |
| `useCofheRemovePermit`                                                                                                                 | `useCofheRemoveACP`                                        |
| `.withPermit()` / `.withoutPermit()`                                                                                                   | `.withACP()` / `.withoutACP()`                             |
| `SelfPermit` / `SharingPermit` / `RecipientPermit`                                                                                     | `SelfACP` / `SharingACP` / `RecipientACP`                  |
| `SerializedPermit`                                                                                                                     | `SerializedACP`                                            |
| `CofheErrorCode.PermitNotFound`                                                                                                        | `CofheErrorCode.ACPNotFound` (`'ACP_NOT_FOUND'`)           |
| `CofheErrorCode.InvalidPermitData`                                                                                                     | `CofheErrorCode.InvalidACPData` (`'INVALID_ACP_DATA'`)     |
| `CofheErrorCode.InvalidPermitDomain`                                                                                                   | `CofheErrorCode.InvalidACPDomain` (`'INVALID_ACP_DOMAIN'`) |
| status fields `missingPermit`, `permitExpired`, `permitExpiringSoon`, `permitShared`, `openPermits`, `disabledDueToMissingValidPermit` | same names with `Permit` → `ACP`                           |

Rule of thumb for anything not listed: replace the token `Permit`/`permit`/`PERMIT` with
`ACP`/`acp`/`ACP` — **but only in identifiers imported from `@cofhe/*`**. Do not touch English words
(`permitted`, `permitting`), and do not rename the on-chain `isAllowedWithPermission` interface.

If the app matches on serialized error codes, note the wire codes changed too: `permit_*` → `acp_*`,
and `permit_revoked` is gone — ACP-era backends fold revocation into `acp_denied`.

---

## Step 3 — Encrypted inputs must name their consuming contract (RUNTIME, type-invisible)

**The compiler will not catch this.** `consumingContract` is an _optional_ field on the options type,
but the builder throws `CofheErrorCode.ConsumingContractUninitialized` ("Consuming contract is not
set") at `execute()` if it is missing. Every encrypt path in the app must be audited by hand:

```bash
grep -rn "encryptInputs(" --include="*.ts" --include="*.tsx" . | grep -v node_modules
```

- **SDK builder:** `client.encryptInputs([...]).setConsumingContract(addr).execute()`.
- **React `useCofheEncrypt`:** pass `consumingContract` in the options object.
- **React `useCofheEncryptAndWriteContract`:** defaults to the write's target `address` — usually
  nothing to do, unless an explicit override is wanted.

`addr` is the contract that will consume the ciphertext (the one calling `FHE.asEuint*`), **not** the
sender. Getting this wrong makes the on-chain verifier recover a different signer and revert.

---

## Step 4 — Encrypt results changed shape (RUNTIME + Solidity)

Batch verification replaced per-item signatures with one signature per batch:

- **Before:** `EncryptedItemInput[]` — one object per input, each carrying its own `signature`.
- **After:** `[...hashes, signature]` — every ciphertext hash, then a single trailing signature.

Consumers that spread the result straight into contract args (especially with `as never` or `as any`,
which silences the compiler) are silently broken. Audit every call that passes encrypted values into
`writeContract` / `simulateContract` / gas estimation.

**The Solidity side changes with it:** contracts consuming these inputs must adopt the batch-verifying
`FHE.asEuint*` signatures from the current `@fhenixprotocol/cofhe-contracts`. A TypeScript-only
migration will compile and then revert on-chain. See `BREAKING_CHANGES.md` in the SDK repo for the
contract-author details, and update `@fhenixprotocol/cofhe-contracts` in `contracts/` alongside it.

---

## Step 5 — Behavioral changes with no compile-time signal

- **Stored ACPs are dropped.** The persisted store key changed; previously stored permits are not
  migrated. Every user re-creates (re-signs) an ACP on first use after the upgrade. If that is
  unacceptable, raise it with the SDK team before shipping — the signatures themselves are still valid.
- **React first-ACP flag resets.** `hasCreatedFirstPermit` → `hasCreatedFirstACP` in the persisted
  portal store, so onboarding prompts may re-appear (or stay suppressed) for existing users.
- **ACPs are now revocable by default,** carrying a timestamp-based revoker and optional contract
  scopes. Defaults are applied at creation; apps that build ACP options by hand should review
  `revokerData`/`revokerContract`/`scope`/`contracts`/`handles`.
- **Sharing ACPs are no longer auto-activated on creation** — select explicitly if the app relied on
  the old behavior.
- **`useCofheToken` no longer probes on-chain.** Apps that depended on probing should use
  `useKnownCofheToken`, or supply token metadata from their own list.
- **Only successful query states are persisted** by the React query cache — transient failures no
  longer rehydrate as cached errors.

---

## Step 6 — Optional: on-chain ACP sharing

New in this window. If the app shares ACPs between users, on-chain sharing (share registry +
`useIncomingShares` / import flows) replaces manual JSON hand-off. Requires a deployment whose ACL
returns a non-zero `shareRegistry()` (step 0). Skip entirely if the app does not share.

---

## Step 7 — Verify

1. `pnpm typecheck` — must be clean.
2. `pnpm build` — must be clean.
3. **Runtime smoke test against a real ACP-era chain** (mocks will not catch step 3/4 breakage):
   - create an ACP,
   - encrypt an input and send it through the target contract,
   - `decryptForView` and `decryptForTx` a value written by that contract,
   - if the app shares ACPs: share, import, and decrypt as the recipient.
4. Watch the console for `CONSUMING_CONTRACT_UNINITIALIZED`, `ACP_DENIED`, or on-chain
   `InvalidSigner` reverts — those are the signatures of an incomplete steps 3–4.

---

## Step 8 — Report

Summarize for the user:

- versions before → after, per manifest;
- counts: renames applied, encrypt sites given a consuming contract, contract-arg sites reshaped;
- **anything that needs a human decision** — dropped stored ACPs, Solidity changes required,
  chains that failed the step 0 preflight;
- **the app's own `Permit`-named internals** (components, hooks, context, local state that are not
  SDK API). List them and let the team decide: they are unaffected by the SDK upgrade, but leaving
  them keeps the old vocabulary alive in the codebase. Do not rename them as part of this migration
  unless the user asks.
