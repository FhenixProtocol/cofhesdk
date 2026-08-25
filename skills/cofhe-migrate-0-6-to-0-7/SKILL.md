---
name: cofhe-migrate-0-6-to-0-7
description: >-
  Migrates a codebase from @cofhe/* v0.6.x to v0.7.x (the ACP + batch-input-verification release;
  0.7.1 is current). Use when a developer asks to upgrade @cofhe/sdk, @cofhe/react,
  @cofhe/hardhat-plugin, @cofhe/hardhat-3-plugin, @cofhe/foundry-plugin, @cofhe/abi or
  @cofhe/mock-contracts, or to upgrade @fhenixprotocol/cofhe-contracts to 0.2.0 or
  fhenix-confidential-contracts to 0.4.0, or when
  they hit any of: "Permit is not exported", "useCofheActivePermit is not defined",
  "Property 'execute' does not exist on type 'EncryptInputsBuilderUnset'",
  "ConsumingContractUninitialized", "Identifier not found or not unique: InEuint32",
  "EncryptedItemInput is not exported", "acp_denied", or a config error naming
  `defaultACPExpiration`. Also triggers on "migrate to ACP", "Permit renamed to ACP",
  "encryptInputs return type changed", or "batch input verification". Also covers moving
  contract-to-contract encrypted values onto the `sharedEuintXX` types — "sharedEuint", "share
  encrypted value between contracts", "pass euint to another contract", "NotShared",
  "UnexpectedSharer", or "Identifier not found or not unique: sharedEuint64". Also covers the
  confidential-token library's own 0.3.x -> 0.4.0 break — "fhenix-confidential-contracts",
  "FHERC20", "ERC20Confidential", "confidentialTransfer", "onConfidentialTransferReceived",
  "ERC20ConfidentialLib", or an unresolved-library link error at token deploy time.
license: MIT
compatibility: >-
  Requires a git repository and a Node package manager. Contract steps additionally require the
  project's Solidity toolchain (forge or hardhat) to compile and redeploy.
metadata:
  author: fhenix
  version: '0.6-to-0.7.1'
---

# Migrate @cofhe/\* 0.6.x → 0.7.1

This release renames Permit→ACP, replaces per-ciphertext input signatures with one signature per
batch, and binds encrypted inputs to a consuming contract. It also pulls in
`@fhenixprotocol/cofhe-contracts` 0.2.0, **which deletes the `InEuintXX` structs** — so most
projects need Solidity changes, not just TypeScript changes.

There are no deprecation shims. Old names are removed so the compiler finds the work.

## Three versions that move together

This is one migration across three independently versioned packages, and all of them are part of
it. Bumping a subset is the most common way to end up with errors that look like SDK bugs.

| Package                           | Target  | Notes                                                             |
| --------------------------------- | ------- | ----------------------------------------------------------------- |
| `@cofhe/*` (every package)        | `0.7.1` | all on one version; `0.7.0` has the same migration surface        |
| `@fhenixprotocol/cofhe-contracts` | `0.2.0` | stable — supersedes the `0.2.0-beta.*` line 0.7.0 shipped against |
| `fhenix-confidential-contracts`   | `0.4.0` | only if the project uses FHERC20 / confidential tokens            |

`fhenix-confidential-contracts` 0.4.0 depends on `@fhenixprotocol/cofhe-contracts` at an **exact**
`0.2.0`, so leaving a `0.2.0-beta.3` pin in place resolves two copies of `FHE.sol` — and
`sharedEuint64` from one is not the same type as `sharedEuint64` from the other. Bump the pin.
Details for each in [environment.md](references/environment.md).

## 0. Before touching anything

1. **Check the working tree is clean.** `git status --porcelain`. If it is not, stop and ask the
   user to commit or stash. This skill edits source files in place.
2. **Establish the starting version.** Read `@cofhe/*`, `@fhenixprotocol/cofhe-contracts` **and**
   `fhenix-confidential-contracts` from `package.json` (and the lockfile if the manifest uses
   ranges). All three are in scope — a project can be done on one and untouched on another.
   - `0.7.x` already → the **JavaScript** packages are done. Three things still routinely lag the
     JS bump, so check each before declaring victory: `InEuint*` in the Solidity, hand-rolled
     `allowTransient` sharing, and the two contract dependencies (`cofhe-contracts` still on
     `0.2.0-beta.*`, `fhenix-confidential-contracts` still on `0.3.x`). Bump those and re-verify.
     If all of it is clean, say so and stop.
   - `0.6.x` → proceed.
   - `0.5.x` → **proceed.** The Solidity work is identical — the `InEuint*` structs did not change
     between 0.5 and 0.6 — so contract Case A applies unchanged. Note in the final report that
     0.5 → 0.6 **TypeScript** changes are outside this skill's scope and were not detected; do not
     make the user do a 0.6.1 hop first.
   - **`< 0.5.0` → refuse.** Say: "This skill migrates 0.5.x–0.6.x → 0.7.1. Upgrade to 0.6.1 first
     using the package changelog, then re-run." Do not attempt a best-effort migration.
   - Coming from `cofhejs` (not `@cofhe/sdk`) → point at the "Migrating from cofhejs" guide first.
   - **Mixed `@cofhe/*` versions within one install graph** → stop and have the user align them
     before migrating. Mixed across **deliberately isolated** graphs (a `contracts/` tree installed
     with `--ignore-workspace`, sharing no resolution with the apps) is fine — note it and move on.
     Do not halt on a version skew that cannot interact.
3. **Detect what's in play** and load only the references you need:

| If the project has                                              | Load                                                                                                                            |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| any Solidity (`foundry.toml`, `hardhat.config.*`, `contracts/`) | [contracts.md](references/contracts.md) **first**                                                                               |
| `@cofhe/sdk` (**including test-only usage**)                    | [encrypt-inputs.md](references/encrypt-inputs.md), [acp-rename.md](references/acp-rename.md)                                    |
| `@cofhe/react`                                                  | [react.md](references/react.md)                                                                                                 |
| any client config (`createCofheConfig`)                         | [config.md](references/config.md)                                                                                               |
| error-code handling / a custom backend                          | [errors-and-wire.md](references/errors-and-wire.md)                                                                             |
| `@cofhe/foundry-plugin`                                         | [foundry.md](references/foundry.md)                                                                                             |
| custom mock deployment scripts                                  | [environment.md](references/environment.md)                                                                                     |
| encrypted values crossing a contract boundary                   | [shared-euints.md](references/shared-euints.md) — **security-relevant, not compiler-detectable**                                |
| `fhenix-confidential-contracts` (FHERC20 / confidential tokens) | [confidential-tokens.md](references/confidential-tokens.md) — its own 0.4.0 break, on top of the above                          |
| any claim / unshield flow (`claimUnshielded`, `getUserClaims`)  | [confidential-tokens.md](references/confidential-tokens.md) §7 — **re-keyed under a stable selector; zero compile-time signal** |
| any test suite                                                  | [tests.md](references/tests.md) — EOAs cannot share; selectors are not compiler-checked                                         |

Rows are independent, not exclusive. A repo with both Hardhat and Foundry tests loads
[encrypt-inputs.md](references/encrypt-inputs.md) **and** [foundry.md](references/foundry.md) — doing
the Foundry side and forgetting `withoutPermit` in `test/*.ts` is a common miss.

4. **Present an inventory table, and wait.** Not a prose plan — a table. This is the first
   user-visible artifact, and no file may be edited before it is agreed:

   When Solidity is in scope:

   | File | Function | Case | Proposed signature | Action |
   | ---- | -------- | ---- | ------------------ | ------ |

   `Case` is A/B/C from [contracts.md](references/contracts.md) or S1/S2 from
   [shared-euints.md](references/shared-euints.md).

   For a TypeScript-only migration — no contracts, no encrypt call sites — those columns are empty
   on every row. Use this instead:

   | File | Symbol / site | Change | Action |
   | ---- | ------------- | ------ | ------ |

   Either way, include the rows you intend to **skip**, with the reason — what was ruled out is what
   makes the rest reviewable. Then ask whether to:

   - **propose** each change as a diff and wait for approval (default), or
   - **apply** everything and report afterwards (only if the user asks for it explicitly).

   Honour that choice for the whole run. Never switch to apply-mode on your own.

## The order matters

Work **contract-first**, then outward. Each step's outcome determines the next one's shape;
going backwards means rewriting the same call sites twice.

1. **Dependencies & chain** — [environment.md](references/environment.md) — all three packages, not
   just `@cofhe/*`
2. **Contracts** — [contracts.md](references/contracts.md) — decide each function's ABI, compile, redeploy —
   then [shared-euints.md](references/shared-euints.md) for every encrypted value crossing a contract
   boundary. A bare handle parameter is a disclosure risk, not a style issue; report each one.
3. **Confidential tokens** — [confidential-tokens.md](references/confidential-tokens.md) — only if the
   project uses `fhenix-confidential-contracts`. After step 2, not instead of it: 0.4.0's interfaces
   are the same `externalEuintXX` and `sharedEuintXX` changes arriving through a dependency, so the
   concepts have to be settled first.
4. **Config keys** — [config.md](references/config.md) — these throw at client construction
5. **Permit → ACP rename** — [acp-rename.md](references/acp-rename.md) — makes the compiler's remaining errors meaningful
6. **Encrypt call sites** — [encrypt-inputs.md](references/encrypt-inputs.md) — batch result + consuming contract
7. **React** — [react.md](references/react.md)
8. **Errors / wire format** — [errors-and-wire.md](references/errors-and-wire.md)
9. **Verify** — [verification.md](references/verification.md)

Step 5 before step 6 is deliberate: sweep the renames first so that every error `tsc` reports
afterwards is a genuine shape problem rather than a missing identifier.

## Rules while editing

- **Show a diff before writing**, unless the user chose apply-mode.
- **Never edit** the lockfile by hand, CI config, or dependencies unrelated to `@cofhe/*`.
- **Only rewrite identifiers that come from a `@cofhe/*` import.** A bare text replace of
  `Permit`→`ACP` will corrupt the user's own unrelated code — see the exclusion list in
  [acp-rename.md](references/acp-rename.md).
- **Be idempotent.** The user may re-run this after an interruption. Check whether each site is
  already migrated before changing it.
- **Only add the proof argument to actual contract calls.** An encrypted input is frequently created
  in one place and _carried_ through others before it is used: a fixture's `return { … encInput … }`,
  a `const { … encInput … } =` destructure, a config object, an array. Those are **not** call sites
  and must not gain a proof argument. Confirm the callee resolves to a contract before patching an
  argument list, and thread the proof through the carrier separately — the fixture returns the proof
  too, and each destructure takes it. A mechanical "append the proof wherever this variable appears"
  corrupts the `return` and the destructures, and reports more patched sites than exist.
- If a change needs a decision only the developer can make (see _Stop and ask_ below), leave the
  code alone, and collect it for the final report.

## Stop and ask — do not guess

- A function takes **two or more encrypted parameters**: its ABI must change shape, and the
  parameter ordering is the developer's call ([contracts.md](references/contracts.md), Case C).
- The project **persisted `EncryptedItemInput` values** (in a DB, a queue, local storage). Those
  records carry per-item signatures that cannot be reconstructed. This is a data migration.
- Encrypted inputs are **produced in one place and consumed in another** (split across
  transactions or services). One batch signature now binds all its hashes to a single contract.
- The contract being called is **third-party**. If the developer doesn't control it, they are
  blocked until that contract migrates. Say so plainly rather than generating code that
  cannot work. This applies to encrypted-input call sites **and** to every contract on the other
  end of an encrypted-value handoff ([shared-euints.md](references/shared-euints.md)).
- A confidential-token proxy is being upgraded and has **unclaimed unshields in flight**. 0.4.0
  re-keys claim records, so pending ones are orphaned and their burned underlying is unrecoverable.
  That is a data migration and a user-funds decision
  ([confidential-tokens.md](references/confidential-tokens.md)).
- The project calls **`claimUnshielded` / `claimUnshieldedBatch`**. The first argument changed
  meaning from a ciphertext handle to a claim id **under an unchanged selector** — so an unmigrated
  call compiles, encodes and broadcasts, then reverts on chain. Nothing in the toolchain catches it.
  Show each call site and get the change confirmed rather than patching them in bulk
  ([confidential-tokens.md](references/confidential-tokens.md), §7).
- The project **displayed a pending claim's amount**. `requestedAmount` is gone with no plaintext
  replacement, so this is now a decrypt per claim under the holder's ACP, and it can partially fail.
  The developer has to decide what the UI shows when an amount cannot be read.

## Finish with a report

State plainly:

- what changed, by area
- what was skipped and why
- what still needs a human decision
- **every bare-handle site left unmigrated**, individually — each is a potential disclosure path
  ([shared-euints.md](references/shared-euints.md)), not a cleanup item
- the resolved version of all three packages, so the reader can tell a partial bump from a full one
- for confidential tokens: the `ERC20ConfidentialLib` address deployed per chain, and any pending
  claim found on a proxy being upgraded
- the verification commands run, and their results
- anything from _Known issues_ below that applies

## Known issues to warn about

- **`ZK_VERIFY_FAILED` depends on which chain you are pointed at.** The verifier's batch endpoint
  is live on **CoFHE staging** and the host chain, and encryption works end-to-end there and
  against hardhat mocks. It is **not yet deployed on the public testnets** (Sepolia, Arbitrum
  Sepolia, Base Sepolia), where batch encryption still fails with `ZK_VERIFY_FAILED`. This is not
  a migration error — tell the user before they debug it, and have them retarget staging to
  confirm their code is correct.
- **A project already on `@cofhe/*` 0.7.0 is not finished.** 0.7.0 shipped against
  `@fhenixprotocol/cofhe-contracts@0.2.0-beta.3`; the stable `0.2.0` is out, and
  `fhenix-confidential-contracts@0.4.0` requires exactly that. Leaving the beta pin in a project
  that also uses confidential tokens duplicates `FHE.sol` and produces type errors between two
  spellings of the same `sharedEuintXX`. Bump both.
- **Resolve versions from the registry, do not quote this file.** `npm view @cofhe/sdk dist-tags`
  and `npm view fhenix-confidential-contracts dist-tags` are the source of truth. If `0.7.1` has
  not landed yet, `0.7.0` is the ACP release and the migration surface is identical — the delta is
  the contract dependencies above, not the user's code.
