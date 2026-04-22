# Integration Matrix

Runs inherited SDK tests across **every supported chain × {Node, Web}**.

## Coverage matrix

|  | Hardhat (Mock) | Local CoFHE | Ethereum Sepolia | Arbitrum Sepolia | Base Sepolia |
|---|:---:|:---:|:---:|:---:|:---:|
| **Node** | ✓ | ✓\* | ✓\* | ✓\* | ✓\* |
| **Web** | ✓ | ✓\* | ✓\* | ✓\* | ✓\* |

\* Enabled when `SimpleTest` is deployed (via `@cofhe/test-setup`) and a funded `TEST_PRIVATE_KEY` is present.
Local CoFHE is a special case that defaults to **disabled** unless `TEST_LOCALCOFHE_ENABLED=true` is in the .env file.

## Usage

```bash
pnpm test              # node then web, all enabled chains
```

`anvil` and `forge` must be on `$PATH`.
Must run `pnpm test:setup` from root before first run.

### Filtering

```bash
MATRIX_CHAIN=hardhat pnpm test:node           # single chain
MATRIX_CHAIN=hardhat,arb-sepolia pnpm test    # multiple chains
MATRIX_CHAIN=testnet pnpm test                # all testnets
MATRIX_ENV=node pnpm test                     # node environment only
MATRIX_ENV=web pnpm test                      # web environment only
```

Valid chain slugs: `hardhat`, `localcofhe`, `sepolia`, `arb-sepolia` / `arbitrum-sepolia`, `base-sepolia`.
Chain IDs are also valid: `31337`, `420105`, `11155111`, `421614`, `84532`.
Group alias `testnet` expands to `sepolia`, `arb-sepolia`, `base-sepolia`.

## Structure

```
setup/
  anvil.ts                   # globalSetup — Anvil + mock deploy + SimpleTest deploy + matrix printout
  foundryArtifactReader.ts   # Foundry artifact shim for @cofhe/hardhat-3-plugin's deployMocks
src/
  matrix.ts                  # chain/env filtering logic (no vitest imports — safe for globalSetup)
  types.ts                   # TestChainConfig, ClientFactory, TestContext
  chains/
    index.ts                 # ALL_CHAINS aggregation
    hardhat.ts               # Anvil mock chain config (injects anvilRpc/anvilSimpleTest via inject)
    testnet.ts               # shared setup for real testnets (account derivation, contract lookup)
  suites/
    inherited.ts             # parameterized test suite (encrypt, decrypt, permits, publishDecryptResult)
    MockTaskManager.ts       # TaskManager ABI for log decoding
test/
  matrix.test.ts             # Node runner — @cofhe/sdk/node
  matrix.web.test.ts         # Web runner — @cofhe/sdk/web
```

## Design and Notes

- **One suite, two runners.** `runInheritedSuite(chain, factory)` contains all test logic. The runners only differ in SDK entrypoint (`/node` vs `/web`) via `ClientFactory`.
- **Chain configs are data.** Each `TestChainConfig` bundles viem chain, CofheChain, RPC, `enabled` flag, and `setup()` → `TestContext`. Adding a chain = one object in `chains/index.ts`.
- **`provide`/`inject` for cross-environment data.** globalSetup passes Anvil RPC, SimpleTest address, `MATRIX_CHAIN`, and `MATRIX_ENV` to tests via Vitest's `provide`/`inject`. Works in both Node and browser without filesystem or `process.env`.
- **`matrix.ts` has zero vitest imports.** This keeps it importable from `globalSetup` (which runs outside Vitest's runtime). Chain filtering and env filtering live here; test files pass `ALL_CHAINS` in as an argument.
- **Sequential execution.** Node and web run as separate `vitest run --project` invocations (`&&`). Prevents nonce collisions on shared testnet wallets.
- **Mock deployment reuses `@cofhe/hardhat-3-plugin`.** globalSetup calls `deployMocks` with a Foundry artifact reader shim — no duplicated mock logic.

