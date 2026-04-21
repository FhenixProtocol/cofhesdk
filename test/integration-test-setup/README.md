# @cofhe/integration-test-setup

Shared test infrastructure for the CoFHE SDK monorepo. This package exists because the SDK's core tests need to interact with real CoFHE-enabled chains (decrypt, verify, publish) but the core package itself has no dependency on a specific runtime (Node vs browser) and no Solidity toolchain. Rather than duplicating deployment scripts, contract ABIs, keys, and on-chain state management across every test package, this single workspace package provides all of it in one place.

It is an **internal** workspace package — never published to npm. Other packages consume it as `@cofhe/integration-test-setup` via pnpm workspace linking.

## Quick start

```bash
# 1. Create your key file
cp test/integration-test-setup/src/key-example.ts test/integration-test-setup/src/key.ts
# Edit key.ts with a funded testnet private key

# 2. Run setup (deploys contracts, initializes values, builds)
pnpm test:setup

# 3. Run tests
pnpm test
```

## How it fits into the repo

```
cofhesdk/
├── packages/sdk/
│   ├── core/test/        ← imports ABIs, pre-stored values, config from this package
│   ├── node/test/        ← imports key, ABIs, contract addresses
│   └── web/test/         ← same (built output avoids process.env issues in browser)
├── test/
│   ├── integration-test-setup/   ← this package
│   └── hardhat-plugin-test/      ← Hardhat-specific mock tests (separate)
└── package.json          ← `test:setup` script runs this before `turbo run test`
```

The root `package.json` runs `pnpm test:setup` before tests, which calls `node setup.mjs` in this package. That single command handles deployment, on-chain initialization, and building — so downstream test packages always have up-to-date contract addresses and pre-stored encrypted values.

## Package structure

```
integration-test-setup/
├── src/                          ← TypeScript source + JSON registries (built by tsup)
│   ├── index.ts                  ← package entry point, re-exports everything
│   ├── config.ts                 ← env-based configuration (PRIMARY_TEST_CHAIN, etc.)
│   ├── key.ts                    ← gitignored, holds TEST_PRIVATE_KEY
│   ├── key-example.ts            ← template for key.ts
│   ├── contracts.ts              ← SimpleTest ABI + address lookup helper
│   ├── primaryTestChain.ts       ← typed accessor for primaryTestChainRegistry.json
│   ├── deployments.json          ← auto-generated contract deployment addresses
│   └── primaryTestChainRegistry.json  ← auto-generated pre-stored encrypted values
├── contracts/                    ← Solidity source (compiled by Foundry)
│   └── SimpleTest.sol
├── setup.mjs                     ← deploy + initialize + build script
├── tsup.config.ts                ← tsup build configuration
├── tsconfig.json                 ← TypeScript configuration
├── foundry.toml                  ← Foundry configuration
├── package.json
├── .gitignore
└── README.md
```

## Files

### `src/key.ts` (gitignored)

Exports the `TEST_PRIVATE_KEY` used for deploying contracts and signing test transactions. This file is **not committed** — each developer creates it from the example:

```bash
cp src/key-example.ts src/key.ts
# edit key.ts with your funded testnet private key
```

The key must have a small ETH balance on the target testnets (Arb Sepolia, Base Sepolia, Eth Sepolia).

### `src/config.ts`

Runtime configuration pulled from environment variables with sensible defaults:

| Export                        | Env var                       | Default           | Purpose                                                 |
| ----------------------------- | ----------------------------- | ----------------- | ------------------------------------------------------- |
| `PRIMARY_TEST_CHAIN`          | `PRIMARY_TEST_CHAIN`          | `421614`          | Chain ID used for core SDK decrypt/verify/publish tests |
| `COFHE_CHAIN_ID`              | `COFHE_CHAIN_ID`              | `421614`          | General-purpose chain ID override                       |
| `TEST_LOCALCOFHE_ENABLED`     | `TEST_LOCALCOFHE_ENABLED`     | `false`           | Include localcofhe in deployment targets                |
| `TEST_LOCALCOFHE_PRIVATE_KEY` | `TEST_LOCALCOFHE_PRIVATE_KEY` | hardcoded default | Deployer key for localcofhe                             |

These values are inlined at build time via `tsup.config.ts`'s `define` option, which replaces `process.env.*` references with literal strings. This is necessary because the web test environment (Vitest + Playwright) does not have access to `process.env`.

### `src/contracts.ts`

Exports the `simpleTestAbi` (parsed via viem's `parseAbi`) and `getSimpleTestAddress(chainId)` helper for looking up deployed addresses from the deployment registry.

### `src/deployments.json`

Auto-generated registry of deployed contract addresses, keyed by contract name and chain ID. Updated by `setup.mjs` whenever a contract is deployed or redeployed. Committed to the repo so that test runs without deployment access can still reference existing addresses.

```json
{
  "SimpleTest": {
    "421614": {
      "address": "0x...",
      "bytecodeHash": "0x...",
      "deployedAt": "2026-04-13T13:50:31.050Z"
    }
  }
}
```

### `src/primaryTestChainRegistry.json`

Auto-generated registry of pre-stored encrypted values on the primary test chain. Updated by `setup.mjs` after deployment. This lets core SDK tests decrypt, verify, and publish **without performing any on-chain encryption** — the ctHashes and handles are ready to use.

Contains:

- **`privateValue`** — stored via `setValueTrivial(42)`, with `allowSender` + `allowThis` (requires a permit to decrypt)
- **`publicValue`** — stored via `setPublicValueTrivial(7)`, with `allowPublic` (decryptable without a permit)
- **`addedValue`** — result of `FHE.add(privateValue, 50)` via `addValueTrivial(50)`, expected sum = 92

### `src/primaryTestChain.ts`

Typed accessor for `primaryTestChainRegistry.json`. Exports `StoredValue` and `PrimaryTestChainRegistry` types, the registry itself, and an `isPrimaryTestChainReady()` type guard that tests use to fail fast with a clear message when setup hasn't been run.

### `contracts/SimpleTest.sol`

A minimal Solidity contract used by integration tests. Supports:

- `setValue` / `setValueTrivial` — store a private encrypted value (`allowSender` + `allowThis`)
- `setPublicValue` / `setPublicValueTrivial` — store a publicly-accessible encrypted value (`allowPublic`)
- `addValue` / `addValueTrivial` — FHE-add to the stored value
- `publishDecryptResult` / `getDecryptResultSafe` — publish and verify decrypt results on-chain

The `*Trivial` variants accept a raw `uint256` and call `FHE.asEuint32(value)` internally, allowing the setup script to store values via `cast send` without needing the SDK's encryption flow.

### `setup.mjs`

The main setup script, run via `pnpm setup` or `pnpm test:setup` from the root. Performs three phases:

1. **Deploy** — `forge build` then `forge create` to each target chain. Skips chains where the bytecodeHash matches and on-chain code exists. Writes `src/deployments.json`.
2. **Initialize primary chain** — On `PRIMARY_TEST_CHAIN`, calls the trivial-encrypt contract functions to store private, public, and FHE-added values. Reads back ctHashes and handles via `cast call`. Writes `src/primaryTestChainRegistry.json`. Skips if the registry already matches the current deployment.
3. **Build** — Runs `pnpm build` (tsup) so that `dist/` contains the latest registry data baked into the built output.

### `tsup.config.ts`

Builds the package to ESM + CJS with declarations from `src/index.ts`. Inlines `process.env` values at build time via `define`, ensuring they work in browser test environments.
