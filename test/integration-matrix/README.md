# Integration Matrix

End-to-end SDK tests that run the same suite against every supported chain in both Node.js and browser environments.

## Structure

```
setup/
  anvil.ts                 # globalSetup — starts Anvil, deploys mocks + SimpleTest
  foundryArtifactReader.ts # reads Foundry out/ to satisfy HH3 plugin's ArtifactManager
src/
  types.ts                 # ClientFactory, TestContext, TestChainConfig
  chains/
    index.ts               # aggregates all chain configs, exports enabledChains
    hardhat.ts             # Anvil mock chain (chain id 31337)
    testnet.ts             # shared setup helper for real testnets
  suites/
    inherited.ts           # the actual test logic, parameterized by chain + factory
test/
  matrix.test.ts           # Node runner — imports SDK from @cofhe/sdk/node
  matrix.web.test.ts       # Web runner — imports SDK from @cofhe/sdk/web
```

## Design choices

**Single test suite, multiple environments.** `runInheritedSuite()` contains all test logic. The two runner files (`matrix.test.ts`, `matrix.web.test.ts`) only differ in which SDK entrypoint they import. A `ClientFactory` abstraction lets the suite call `createConfig` / `createClient` without knowing the environment.

**Chain configs are data.** Each `TestChainConfig` bundles a viem chain, a CofheChain, an RPC URL, an `enabled` flag, and a `setup()` function. Adding a new chain is one object in `chains/index.ts`.

**Hardhat mocks via Anvil + HH3 plugin.** The globalSetup starts an Anvil node and calls `deployMocks` from `@cofhe/hardhat-3-plugin` with a thin Foundry artifact reader shim. This avoids duplicating mock deployment logic and keeps behavior identical to the HH3 plugin.

**`provide` / `inject` for cross-environment data.** The globalSetup passes the deployed `SimpleTest` address to tests via vitest's `provide`/`inject` API. This works in both Node and browser without filesystem access.

**Sequential project execution.** Node and web are run as separate `vitest run --project` invocations chained with `&&`. This prevents nonce collisions when both environments send transactions to the same testnet wallets.

**Testnet enablement is automatic.** A testnet chain is enabled only if a `SimpleTest` contract is deployed on it (checked via `@cofhe/integration-test-setup`'s deployment registry) and a funded private key is available. No manual flags needed.

## Running

```bash
pnpm test              # node then web, all enabled chains
pnpm test:node         # node only
pnpm test:web          # web only
```

### Filtering by chain

Use the `MATRIX_CHAIN` env var to run one or more chains (comma-separated):

```bash
MATRIX_CHAIN=hardhat pnpm test:node
MATRIX_CHAIN=hardhat,arb-sepolia pnpm test
MATRIX_CHAIN=sepolia pnpm test:web
```

Valid values: `hardhat`, `localcofhe`, `sepolia`, `arb-sepolia`, `base-sepolia`, `testnet` (expands to all testnets).

### Requirements

`anvil` and `forge` must be on `$PATH`.
