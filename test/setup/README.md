# @cofhe/test-setup

Shared test infrastructure for the monorepo. Deploys `SimpleTest` contracts to target chains, pre-stores encrypted values for core SDK tests, and builds a distributable package consumed by other test packages.

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
│   ├── contracts.ts                    # SimpleTest ABI + address lookup
│   ├── primaryTestChain.ts             # typed accessor for pre-stored values
│   ├── deployments.json                # auto-generated deploy addresses (committed)
│   └── primaryTestChainRegistry.json   # auto-generated pre-stored values (committed)
├── setup.mjs                           # deploy + initialize + build script
├── tsup.config.ts                      # build config (inlines process.env via define)
└── foundry.toml
```

## Environment variables

Loaded from root `.env`. See `.env-example` for a template.

| Variable                      | Default           | Purpose                                                      |
| ----------------------------- | ----------------- | ------------------------------------------------------------ |
| `TEST_PRIVATE_KEY`            | — (required)      | Deployer / test account key (≥ 0.1 ETH on each target chain) |
| `PRIMARY_TEST_CHAIN`          | `421614`          | Chain ID for pre-stored values (core SDK tests)              |
| `TEST_LOCALCOFHE_PRIVATE_KEY` | hardcoded default | Deployer key for localcofhe (skipped if unset)               |

These are inlined at build time by `tsup.config.ts`'s `define` so they work in browser test environments where `process.env` is unavailable.

## setup.mjs

Three phases:

1. **Deploy** — `forge build` → `forge create` to each target chain. Skips when bytecodeHash matches and on-chain code exists. Writes `src/deployments.json`.
2. **Initialize primary chain** — On `PRIMARY_TEST_CHAIN`, calls trivial-encrypt functions to store private (`42`), public (`7`), and added (`42+50=92`) values. Writes `src/primaryTestChainRegistry.json`. Skips if registry already matches current deployment.
3. **Build** — `pnpm build` (tsup + forge build) so `dist/` has the latest registry data baked in.

CLI options: `--chains <ids>` (comma-separated), `--dry-run`.

## Key files

### `contracts/SimpleTest.sol`

Supports `setValue`/`setValueTrivial`, `setPublicValue`/`setPublicValueTrivial`, `addValue`/`addValueTrivial`, `publishDecryptResult`/`getDecryptResultSafe`. The `*Trivial` variants accept raw `uint256` and call `FHE.asEuint32` internally — used by `setup.mjs` to store values via `cast send` without the SDK encryption flow.

### `src/deployments.json`

Auto-generated registry keyed by `[contractName][chainId]`. Committed so tests can reference existing addresses without deploy access.

### `src/primaryTestChainRegistry.json`

Pre-stored encrypted values on the primary test chain. Lets core SDK tests decrypt/verify/publish without performing on-chain encryption. Contains `privateValue` (permit-gated), `publicValue` (public), `addedValue` (FHE.add result).

### `src/env.ts`

Exports `TEST_PRIVATE_KEY`, `TEST_LOCALCOFHE_PRIVATE_KEY`, `PRIMARY_TEST_CHAIN`. All `process.env` references are replaced at build time.

### `src/primaryTestChain.ts`

Typed accessor for `primaryTestChainRegistry.json`. Exports the registry and `isPrimaryTestChainReady()` type guard — tests call this to fail fast with a clear message when setup hasn't been run.
