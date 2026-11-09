# @cofhe/test-setup

Shared test infrastructure for the monorepo. Finds or deploys the `SimpleTest` fixture on each target chain, makes sure it holds the values the core SDK tests read, and builds a distributable package consumed by other test packages.

The chain is the only source of truth. Nothing about deployments or stored values is committed: `pnpm test:setup` detects a bytecode change, deploys when needed, reuses what is already there, and hands the addresses to the bundle of this checkout.

Internal workspace package — never published to npm.

## Usage

```bash
pnpm test:setup        # from repo root (runs setup.mjs then builds)
pnpm test              # runs test:setup automatically before turbo run test
```

## Structure

```
setup/
├── contracts/
│   └── SimpleTest.sol                  # minimal FHE test contract
├── src/
│   ├── index.ts                        # package entry point
│   ├── env.ts                          # env config, inlined at build time
│   └── contracts.ts                    # SimpleTest address + pinned value lookup (from deployments.local.json, inlined at build)
├── setup.mjs                           # find-or-deploy + store values + build script
├── create2.mjs                         # CREATE2 deployer, salt and address derivation shared by setup and tests
├── deployments.local.json              # what setup.mjs found, deployed or stored for this checkout; not committed
├── tsup.config.ts                      # build config (inlines process.env and deployments.local.json via define)
└── foundry.toml
```

## Environment variables

Loaded from root `.env`. See `.env-example` for a template.

| Variable                      | Default           | Purpose                                                         |
| ----------------------------- | ----------------- | --------------------------------------------------------------- |
| `TEST_PRIVATE_KEY`            | — (required)      | Deployer / test account key (≥ 0.1 ETH on each target chain)    |
| `PRIMARY_TEST_CHAIN`          | `421614`          | Chain whose SimpleTest holds the values the core SDK tests read |
| `TEST_LOCALCOFHE_PRIVATE_KEY` | hardcoded default | Deployer key for localcofhe (skipped if unset)                  |

These are inlined at build time by `tsup.config.ts`'s `define` so they work in browser test environments where `process.env` is unavailable.

## setup.mjs

Three phases:

1. **Deploy** — `forge build`, then one of two paths per chain, detected with `cast code`:

   - Chains with the deterministic CREATE2 deployer (`0x4e59b44847b379578588920cA78FbF26c0B4956C`; the three testnets) get `SimpleTest` at an address computed from a fixed salt and the bytecode (`create2.mjs`). The deploy is skipped when that address already has code, and a failed deploy still counts when the code is there afterwards (another run got there first). So a bytecode change deploys once, from whichever run sees it first, and every later run on any machine finds it.
   - Other chains (CoFHE staging, localcofhe) use `forge create`, skipped when the local record's bytecodeHash matches and the address has code. These chains reset, so a fresh checkout deploys there once per run.

   Writes `deployments.local.json`.

2. **Values** — On `PRIMARY_TEST_CHAIN` (and staging when `TEST_STAGING_ENABLED=true`), stores `storedValue` (42, readable by the account that stored it) and `publicValue` (7, readable by everyone) with the trivial-encrypt functions and pins the resulting handles in `deployments.local.json`. The fixture is shared and other suites overwrite it, but a handle stays decryptable after the contract moves on, so the decrypt tests use the pinned handles, and setup skips this step while the TaskManager's ACL still allows them for this account. A fresh checkout stores once.
3. **Build** — `pnpm build` (tsup + forge build) so `dist/` has `deployments.local.json` baked in.

CLI options: `--chains <ids>` (comma-separated), `--dry-run`.

## Key files

### `contracts/SimpleTest.sol`

Supports `setValue`/`setValueTrivial`, `setPublicValue`/`setPublicValueTrivial`, `addValue`/`addValueTrivial`, `publishDecryptResult`/`getDecryptResultSafe`. The `*Trivial` variants accept raw `uint256` and call `FHE.asEuint32` internally — used by `setup.mjs` to store values via `cast send` without the SDK encryption flow.

### `deployments.local.json`

Written by `setup.mjs`: `SimpleTest[chainId]` holds the address, `SimpleTestValues[chainId]` the pinned handles, the plaintexts and the account that stored them (staging under `420105-staging`, since it shares localcofhe's chain ID). Not committed: it describes what this checkout found, deployed or stored, and tsup inlines it into `dist/`. `getSimpleTestAddress` and `getSimpleTestValues` return `undefined` for a chain setup has not run for, which the live suites report as "run `pnpm test:setup`".

### `src/env.ts`

Exports `TEST_PRIVATE_KEY`, `TEST_LOCALCOFHE_PRIVATE_KEY`, `PRIMARY_TEST_CHAIN`. All `process.env` references are replaced at build time.
