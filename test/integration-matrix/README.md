# Integration Matrix

Runs inherited SDK tests across **every supported chain × {Node, Web}**.

The `@cofhe/react` hook tests that need a chain are not here. They only ever ran on Anvil, so they live in `packages/react/test/chain` and run without the testnet keys.

## Coverage matrix

|          | Hardhat (Mock) | Local CoFHE | Ethereum Sepolia | Arbitrum Sepolia | Base Sepolia | CoFHE Staging |
| -------- | :------------: | :---------: | :--------------: | :--------------: | :----------: | :-----------: |
| **Node** |       ✓        |     ✓\*     |       ✓\*        |       ✓\*        |     ✓\*      |      ✓\*      |
| **Web**  |       ✓        |     ✓\*     |       ✓\*        |       ✓\*        |     ✓\*      |      ✓\*      |

\* Enabled when `SimpleTest` is deployed (via `@cofhe/test-setup`) and a funded `TEST_PRIVATE_KEY` is present.
On a testnet the recipient ("Alice") is `TEST_ALICE_PRIVATE_KEY` if set, else a key generated for the run. Set it to a funded key of your own to also run her transaction in the on-chain share flow (dismissing the share); with a generated key the issuer cancels the share instead. Why never a public key: `test/setup/src/env.ts`.
Local CoFHE and CoFHE Staging are **opt-in** — disabled by default unless `MATRIX_CHAIN` explicitly names them
(`localcofhe`, `staging`) or uses the `all` group. CoFHE Staging shares its chain ID (420105) with Local CoFHE
(same devnet genesis, hosted remotely) — select it by the `staging` slug, not by chain ID.

## Usage

Run these commands from `test/integration-matrix`. From the repo root, use `pnpm --filter @cofhe/integration-matrix <script>` instead.

```bash
pnpm test              # node only locally, node + web in CI (CI=true)
pnpm test:node         # node only
pnpm test:web          # web only
pnpm test:all          # node then web, unconditionally
pnpm test:unit         # unit tests for matrix filtering logic only (fast, no chain required)
```

`anvil` and `forge` must be on `$PATH`. The Anvil node, the mocks and the test contracts come from `@cofhe/test-anvil`.
Must run `pnpm test:setup` from root before first run.

### CI vs local

`pnpm test` delegates to `scripts/test.mjs`, which checks `CI`. When `CI=true` (set automatically by GitHub Actions), it runs `test:all`. Locally it runs `test:node` only — browser tests are slow, require Playwright, and must be run sequentially after the node tests (nonce collisions), so they're skipped by default.

### Flexible tests

`src/suites/flexible.ts` is a scratch pad for in-progress feature work. Write tests there freely; move them to `inherited.ts` when they should be enforced across all chains.

```bash
pnpm test:flexible        # node only
pnpm test:flexible:web    # web only
pnpm test:flexible:all    # node then web
```

Flexible tests do not run in CI. Only `test:node` and `test:web` do, and those run the inherited suite. A test that should be enforced on every chain belongs in `inherited.ts`, not in a file of its own: the CI scripts name their files explicitly, and a new file is easy to leave out.

### Filtering

```bash
MATRIX_CHAIN=hardhat pnpm test:node           # single chain
MATRIX_CHAIN=hardhat,arb-sepolia pnpm test    # multiple chains
MATRIX_CHAIN=testnet pnpm test                # all testnets
MATRIX_CHAIN=localcofhe pnpm test:node        # localcofhe opt-in
MATRIX_CHAIN=staging pnpm test:node           # CoFHE staging opt-in
MATRIX_CHAIN=all pnpm test                    # all chains, including localcofhe and staging
MATRIX_ENV=node pnpm test                     # node environment only
MATRIX_ENV=web pnpm test                      # web environment only
```

From the repo root, the equivalent commands are:

```bash
MATRIX_CHAIN=arb-sepolia pnpm --filter @cofhe/integration-matrix test
MATRIX_CHAIN=hardhat pnpm --filter @cofhe/integration-matrix test:node
```

Valid chain slugs: `hardhat`, `localcofhe`, `sepolia`, `arb-sepolia` / `arbitrum-sepolia`, `base-sepolia`, `staging`.
Chain IDs are also valid: `31337`, `420105` (→ Local CoFHE), `11155111`, `421614`, `84532`.
Group aliases: `testnet` → `sepolia`, `arb-sepolia`, `base-sepolia`; `all` → every chain including `localcofhe` and `staging`.

## Structure

```
setup/
  anvil.ts                   # globalSetup — selected chains/envs, the shared Anvil via @cofhe/test-anvil, matrix printout
src/
  matrix.ts                  # chain/env filtering logic (no vitest imports — safe for globalSetup)
  types.ts                   # TestChainConfig, ClientFactory, TestContext
  chains/
    index.ts                 # ALL_CHAINS aggregation
    hardhat.ts               # Anvil mock chain config (injects anvilRpc/anvilSimpleTest via inject)
    testnet.ts               # shared setup for real testnets (account derivation, contract lookup)
  suites/
    inherited.ts             # stable suite — runs on every chain in CI, move tests here when finalised
                             # (client surface, encrypt, decrypt round trips, and the three ACP flows:
                             #  on-chain share, checkAccess, scoped revocable acp)
    flexible.ts              # scratch pad — ad-hoc tests during feature development
    MockTaskManager.ts       # TaskManager ABI for log decoding
scripts/
  test.mjs                   # CI vs local dispatch (CI=true → test:all, else → test:node)
test/
  matrix.test.ts             # Node runner for inherited suite — @cofhe/sdk/node
  matrix.web.test.ts         # Web runner for inherited suite — @cofhe/sdk/web
  flexible.test.ts           # Node runner for flexible suite
  flexible.web.test.ts       # Web runner for flexible suite
  matrix-filter.test.ts      # unit tests for the chain filter
```

## Design and Notes

- **One suite, two runners.** `runInheritedSuite(chain, factory)` contains all test logic. The runners only differ in SDK entrypoint (`/node` vs `/web`) via `ClientFactory`.
- **Chain configs are data.** Each `TestChainConfig` bundles viem chain, CofheChain, RPC, `enabled` flag, and `setup()` → `TestContext`. Adding a chain = one object in `chains/index.ts`.
- **`provide`/`inject` for cross-environment data.** globalSetup passes Anvil RPC, SimpleTest address, `MATRIX_CHAIN`, and `MATRIX_ENV` to tests via Vitest's `provide`/`inject`. Works in both Node and browser without filesystem or `process.env`.
- **`matrix.ts` has zero vitest imports.** This keeps it importable from `globalSetup` (which runs outside Vitest's runtime). Chain filtering and env filtering live here; test files pass `ALL_CHAINS` in as an argument.
- **Sequential execution.** Node and web run as separate `vitest run --project` invocations (`&&`). Prevents nonce collisions on shared testnet wallets.
- **CI vs local.** `scripts/test.mjs` reads `CI` to decide whether to run `test:all` or `test:node`. Browser tests require Playwright and are slower, so they're skipped locally unless explicitly requested.
- **`inherited` vs `flexible`.** `inherited.ts` is the stable contract — every test must pass on every chain before merging. `flexible.ts` is unguarded scratch space; graduate tests to `inherited.ts` once they stabilise.
- **The Anvil is shared code.** `@cofhe/test-anvil` starts the node and deploys the mocks (through `@cofhe/hardhat-3-plugin`'s `deployMocks`) and the test contracts. `@cofhe/react`'s chain tests use the same package.
