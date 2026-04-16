# Testing

## Repo Structure

```
test/
  integration-test-setup/     # shared contracts, deployment registry, setup script
  integration-matrix/          # cross-chain × cross-environment SDK test runner
  hardhat-plugin-test/         # HH2 plugin integration tests
  hardhat-3-plugin-test/       # HH3 plugin integration tests

packages/sdk/
  core/test/                   # unit tests for core SDK logic (decrypt, encrypt, permits, etc.)
  node/test/                   # node-specific tests + inherited tests against real chains
  web/test/                    # web-specific tests + inherited tests against real chains
```

Test packages live under `test/` (added to `pnpm-workspace.yaml` as `test/*`). They are non-publishable (`"private": true`).

SDK tests under `packages/sdk/` were reorganized from flat files next to source into dedicated `test/` folders per subpackage (`core/test/`, `node/test/`, `web/test/`).

---

## Local vs Inherited Tests

Every test package separates tests into two categories:

| Category | Tests | Examples |
|---|---|---|
| **Local** | Functionality specific to that package | Plugin logging, mock deployment, error decoding, client utils |
| **Inherited** | Underlying SDK behavior exercised through the package's entry point | Encrypt, decrypt, permits, client creation, connection |

Inherited tests verify that the SDK works correctly regardless of how it is consumed. The same logical assertions apply whether the SDK runs inside a Hardhat plugin, a Node.js process, or a browser. Local tests cover package-specific surface area that has no equivalent elsewhere.

In practice:
- `test/hardhat-3-plugin-test/test/inherited.test.ts` — SDK encrypt/decrypt/permits running through the HH3 plugin.
- `test/hardhat-3-plugin-test/test/deploy-mocks.test.ts` — local: plugin-specific mock deployment logic.
- `packages/sdk/node/test/inherited.test.ts` — SDK inherited tests via `@cofhe/sdk/node`.
- `packages/sdk/node/test/client.test.ts` — local: node-specific client behavior.
- `test/integration-matrix/` — inherited tests at scale: same suite across all chains × both environments.

---

## `@cofhe/integration-test-setup`

Workspace package that provides shared test infrastructure consumed by SDK tests and the integration matrix.

### What it exports

| Export | Purpose |
|---|---|
| `simpleTestAbi` | ABI for `SimpleTest.sol` |
| `getSimpleTestAddress(chainId)` | Looks up deployed address from `deployments.json` |
| `TEST_PRIVATE_KEY` | Deployer/test key (inlined at build time) |
| `TEST_LOCALCOFHE_ENABLED` | Whether localcofhe chain is configured |
| `PRIMARY_TEST_CHAIN` | Chain ID used for pre-stored values (default: Arb Sepolia / 421614) |
| `primaryTestChainRegistry` | Pre-stored ctHashes/handles for core decrypt tests |

### `setup.mjs`

Single entry point for preparing the test environment. Run via `pnpm --filter @cofhe/integration-test-setup run setup` or root `pnpm test:setup`.

Three phases:
1. **Deploy** — `forge create` `SimpleTest` to all enabled chains. Uses `bytecodeHash` to skip redeployment when contract is unchanged. Results in `src/deployments.json`.
2. **Initialize primary chain** — Calls `setValueTrivial`, `setPublicValueTrivial`, `addValueTrivial` on the primary chain to pre-store encrypted values. Results in `src/primaryTestChainRegistry.json`. Skipped when registry matches current deployment.
3. **Build** — Runs `tsup` + `forge build`. Environment variables are inlined via tsup's `define` so they work in browser test contexts.

Env vars loaded from root `.env`:

| Variable | Required | Purpose |
|---|---|---|
| `TEST_PRIVATE_KEY` | Yes | Deployer/test account key |
| `PRIMARY_TEST_CHAIN` | No (default 421614) | Chain for pre-stored values |
| `TEST_LOCALCOFHE_ENABLED` | No | Set `true` to include localcofhe |
| `TEST_LOCALCOFHE_PRIVATE_KEY` | When localcofhe enabled | Deployer key for localcofhe |

Requires `forge` and `cast` (Foundry) on `$PATH`.

---

## `@cofhe/integration-matrix`

Runs the same test suite against every supported chain in both Node.js and browser (Playwright/Chromium) environments.

### Coverage Matrix

|  | Hardhat (Mock) | Local CoFHE | Ethereum Sepolia | Arbitrum Sepolia | Base Sepolia |
|---|:---:|:---:|:---:|:---:|:---:|
| **Node** | ✓ | ✓* | ✓* | ✓* | ✓* |
| **Web** | ✓ | ✓* | ✓* | ✓* | ✓* |

\* Enabled automatically when `SimpleTest` is deployed and a funded `TEST_PRIVATE_KEY` is present.

### Architecture

```
ClientFactory ──► runInheritedSuite(chainConfig, factory) ◄── TestChainConfig
```

- **`ClientFactory`**: Wraps `createCofheConfig` + `createCofheClient` — differs only by import path (`@cofhe/sdk/node` vs `@cofhe/sdk/web`).
- **`TestChainConfig`**: Data object per chain: viem chain, CofheChain, RPC URL, `enabled` flag, `setup(factory) → TestContext`.
- **`TestContext`**: Contains `cofheClient`, `publicClient`, two wallet clients (Bob + Alice), accounts, deployed `contractAddress`, `chainId`.
- **`runInheritedSuite()`**: All test logic. Covers client creation, connection, encrypt, self permit, sharing permit, decrypt-for-view, decrypt-for-tx.

### Supported chains

| Slug | Chain ID | Label | Type |
|---|---|---|---|
| `hardhat` | 31337 | Hardhat (Mock) | Anvil + mocks |
| `localcofhe` | 420105 | Local CoFHE | Local dev |
| `sepolia` | 11155111 | Ethereum Sepolia | Testnet |
| `arb-sepolia` | 421614 | Arbitrum Sepolia | Testnet |
| `base-sepolia` | 84532 | Base Sepolia | Testnet |

### Hardhat mock setup

Global setup (`setup/anvil.ts`) runs once per `vitest run` invocation:
1. Spawns Anvil on port 8546, chain ID 31337.
2. Calls `deployMocks()` from `@cofhe/hardhat-3-plugin` — reuses existing mock deployment logic. A `FoundryArtifactReader` shim reads Foundry's `out/` JSON from `@cofhe/mock-contracts` to satisfy the `ArtifactManager` interface.
3. Deploys `SimpleTest` via `forge create`.
4. Passes Anvil RPC URL and contract address to tests via `project.provide()` / `inject()`.

This mechanism works in both Node and browser because Vitest serializes provided values across environments.

### Chain filtering (`MATRIX_CHAIN`)

```bash
MATRIX_CHAIN=hardhat pnpm test:node          # single chain
MATRIX_CHAIN=hardhat,arb-sepolia pnpm test   # multiple chains
MATRIX_CHAIN=testnet pnpm test               # alias: all testnets
```

The value is injected at transform time via Vitest `define`:
```
define: { 'process.env.MATRIX_CHAIN': JSON.stringify(process.env.MATRIX_CHAIN ?? '') }
```

Group aliases are defined in `CHAIN_GROUPS` (currently: `testnet` → `sepolia`, `arb-sepolia`, `base-sepolia`). Numeric chain IDs and alternate spellings (e.g. `arbitrum-sepolia`) are also accepted.

### Testnet auto-enablement

A testnet chain is enabled only when:
1. `getSimpleTestAddress(chainId)` returns an address (contract deployed via `setup.mjs`).
2. `TEST_PRIVATE_KEY` is not the default Anvil key (i.e., a real funded key is present).

No manual flags needed — run `setup.mjs` once, then testnets that have deployments are included automatically.

---

## Running Tests

```bash
# Full pipeline: deploy contracts, then run all SDK + plugin tests
pnpm test

# Setup only (deploy contracts, initialize primary chain, build)
pnpm test:setup

# Integration matrix only
cd test/integration-matrix
MATRIX_CHAIN=hardhat pnpm test:node
```

Root `test` script: `pnpm run test:setup && turbo run test`.

---

## Constraints

- **Sequential node/web execution.** Integration matrix runs `vitest run --project node && vitest run --project web`. Cannot run concurrently — shared wallet nonces cause collisions.
- **No `extends: true` in Vitest projects.** Causes `globalSetup` to execute once per project instead of once total. Each project must duplicate `globals: true` and `testTimeout`.
- **`process.env` in browser tests.** Vite strips `process.env` references. Use Vitest `define` to inline values at build time. The integration-test-setup package uses `tsup` `define` for the same reason.
- **Vitest `provide`/`inject` for cross-environment data.** Preferred over env vars or filesystem for passing runtime values (e.g., Anvil contract addresses) from globalSetup to tests. Works in both Node and browser workers.
- **`forge create --chain` collision.** Do not use a `define` key containing `CHAIN` (e.g., `process.env.CHAIN`) — Vite's text replacement will break `forge create --chain` in globalSetup scripts. The current key is `process.env.MATRIX_CHAIN`.
- **Testnet transports.** Public RPCs are unreliable. Testnet configs use `timeout: 60_000`, `retryCount: 3` on the HTTP transport and `pollingInterval: 4_000` on the public client. All `waitForTransactionReceipt` calls use `retryCount: 30, pollingInterval: 4_000`.
- **Foundry required.** `anvil` and `forge` must be on `$PATH` for the integration matrix (Hardhat mock tests) and `setup.mjs` (contract deployment).
- **`@cofhe/hardhat-3-plugin` is a devDep of integration-matrix.** Intentional — `deployMocks` is reused rather than reimplemented. Hardhat becomes a transitive devDep.
