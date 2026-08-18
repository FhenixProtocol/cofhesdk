---
name: cofhe-migrate-0-6-to-0-7
description: >-
  Migrates a codebase from @cofhe/* v0.6.x to v0.7.0 (the ACP + batch-input-verification release).
  Use when a developer asks to upgrade @cofhe/sdk, @cofhe/react, @cofhe/hardhat-plugin,
  @cofhe/hardhat-3-plugin, @cofhe/foundry-plugin, @cofhe/abi or @cofhe/mock-contracts, or when
  they hit any of: "Permit is not exported", "useCofhePermits is not defined",
  "Property 'execute' does not exist on type 'EncryptInputsBuilderUnset'",
  "ConsumingContractUninitialized", "Identifier not found or not unique: InEuint32",
  "EncryptedItemInput is not exported", "acp_denied", or a config error naming
  `defaultACPExpiration`. Also triggers on "migrate to ACP", "Permit renamed to ACP",
  "encryptInputs return type changed", or "batch input verification". Also covers moving
  contract-to-contract encrypted values onto the `sharedEuintXX` types — "sharedEuint", "share
  encrypted value between contracts", "pass euint to another contract", "NotShared",
  "UnexpectedSharer", or "Identifier not found or not unique: sharedEuint64".
license: MIT
compatibility: >-
  Requires a git repository and a Node package manager. Contract steps additionally require the
  project's Solidity toolchain (forge or hardhat) to compile and redeploy.
metadata:
  author: fhenix
  version: '0.6-to-0.7'
---

# Migrate @cofhe/\* 0.6.x → 0.7.0

This release renames Permit→ACP, replaces per-ciphertext input signatures with one signature per
batch, and binds encrypted inputs to a consuming contract. It also pulls in
`@fhenixprotocol/cofhe-contracts` 0.2.x, **which deletes the `InEuintXX` structs** — so most
projects need Solidity changes, not just TypeScript changes.

There are no deprecation shims. Old names are removed so the compiler finds the work.

## 0. Before touching anything

1. **Check the working tree is clean.** `git status --porcelain`. If it is not, stop and ask the
   user to commit or stash. This skill edits source files in place.
2. **Establish the starting version.** Read the `@cofhe/*` versions from `package.json` (and the
   lockfile if the manifest uses ranges).
   - `0.7.x` already → nothing to do; say so and stop.
   - `0.6.x` → proceed.
   - **`< 0.6.0` → refuse.** Say: "This skill migrates 0.6.x → 0.7.0. Upgrade to 0.6.1 first
     using the package changelog, then re-run." Do not attempt a best-effort migration.
   - Coming from `cofhejs` (not `@cofhe/sdk`) → point at the "Migrating from cofhejs" guide first.
   - **Mixed `@cofhe/*` versions** → stop and have the user align them before migrating.
3. **Detect what's in play** and load only the references you need:

| If the project has                                              | Load                                                                                             |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| any Solidity (`foundry.toml`, `hardhat.config.*`, `contracts/`) | [contracts.md](references/contracts.md) **first**                                                |
| `@cofhe/sdk`                                                    | [encrypt-inputs.md](references/encrypt-inputs.md), [acp-rename.md](references/acp-rename.md)     |
| `@cofhe/react`                                                  | [react.md](references/react.md)                                                                  |
| any client config (`createCofheConfig`)                         | [config.md](references/config.md)                                                                |
| error-code handling / a custom backend                          | [errors-and-wire.md](references/errors-and-wire.md)                                              |
| `@cofhe/foundry-plugin`                                         | [foundry.md](references/foundry.md)                                                              |
| custom mock deployment scripts                                  | [environment.md](references/environment.md)                                                      |
| encrypted values crossing a contract boundary                   | [shared-euints.md](references/shared-euints.md) — **security-relevant, not compiler-detectable** |

4. **Present the plan and get confirmation.** List the archetype detected, the ordered steps, and
   the files you expect to touch. Then ask whether to:

   - **propose** each change as a diff and wait for approval (default), or
   - **apply** everything and report afterwards (only if the user asks for it explicitly).

   Honour that choice for the whole run. Never switch to apply-mode on your own.

## The order matters

Work **contract-first**, then outward. Each step's outcome determines the next one's shape;
going backwards means rewriting the same call sites twice.

1. **Dependencies & chain** — [environment.md](references/environment.md)
2. **Contracts** — [contracts.md](references/contracts.md) — decide each function's ABI, compile, redeploy —
   then [shared-euints.md](references/shared-euints.md) for every encrypted value crossing a contract
   boundary. A bare handle parameter is a disclosure risk, not a style issue; report each one.
3. **Config keys** — [config.md](references/config.md) — these throw at client construction
4. **Permit → ACP rename** — [acp-rename.md](references/acp-rename.md) — makes the compiler's remaining errors meaningful
5. **Encrypt call sites** — [encrypt-inputs.md](references/encrypt-inputs.md) — batch result + consuming contract
6. **React** — [react.md](references/react.md)
7. **Errors / wire format** — [errors-and-wire.md](references/errors-and-wire.md)
8. **Verify** — [verification.md](references/verification.md)

Step 4 before step 5 is deliberate: sweep the renames first so that every error `tsc` reports
afterwards is a genuine shape problem rather than a missing identifier.

## Rules while editing

- **Show a diff before writing**, unless the user chose apply-mode.
- **Never edit** the lockfile by hand, CI config, or dependencies unrelated to `@cofhe/*`.
- **Only rewrite identifiers that come from a `@cofhe/*` import.** A bare text replace of
  `Permit`→`ACP` will corrupt the user's own unrelated code — see the exclusion list in
  [acp-rename.md](references/acp-rename.md).
- **Be idempotent.** The user may re-run this after an interruption. Check whether each site is
  already migrated before changing it.
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

## Finish with a report

State plainly:

- what changed, by area
- what was skipped and why
- what still needs a human decision
- **every bare-handle site left unmigrated**, individually — each is a potential disclosure path
  ([shared-euints.md](references/shared-euints.md)), not a cleanup item
- the verification commands run, and their results
- anything from _Known issues_ below that applies

## Known issues to warn about

- **`ZK_VERIFY_FAILED` depends on which chain you are pointed at.** The verifier's batch endpoint
  is live on **CoFHE staging** and the host chain, and encryption works end-to-end there and
  against hardhat mocks. It is **not yet deployed on the public testnets** (Sepolia, Arbitrum
  Sepolia, Base Sepolia), where batch encryption still fails with `ZK_VERIFY_FAILED`. This is not
  a migration error — tell the user before they debug it, and have them retarget staging to
  confirm their code is correct.
- **`@fhenixprotocol/cofhe-contracts` is pinned to a `0.2.0-beta.*` prerelease** — `0.2.0-beta.3`
  as of this release, which is also the floor for the `sharedEuintXX` types. Confirm the final
  `0.2.0` version before relying on the pin in a production project.
