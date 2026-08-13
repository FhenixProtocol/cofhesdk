---
name: matrix-test
description: >-
  Runs cofhesdk's integration-matrix test workflow: building the SDK, running
  test:setup (deploy contracts + fund accounts), and/or running the integration
  matrix tests against a given chain and environment. Invoked as `/matrix-test <steps>`,
  e.g. `/matrix-test staging node`, `/matrix-test setup`, `/matrix-test build`, or chained
  phrasing like `/matrix-test build setup then run staging node`.
disable-model-invocation: true
---

# Matrix Test

Runs `/matrix-test <steps>` against the cofhesdk repo at the workspace root. `<steps>` is
free-form natural language naming one or more of the actions below, run **in the order
named**, sequentially.

## Steps

- **`build`** — rebuild the SDK (needed after any core SDK code change):
  `pnpm --filter @cofhe/sdk build` from the repo root.
- **`setup`** — deploy/verify SimpleTest contracts and fund test accounts:
  `pnpm test:setup` from the repo root. Auto-funds the staging deployer from
  `STAGING_FUNDER_KEY` when it drops below 0.1 ETH; real testnets still require manual
  faucet funding if the report errors with `has less than 0.1 ETH`.
- **`<chain> [env]`** — run the integration matrix, from `test/integration-matrix`:
  - `MATRIX_CHAIN=<chain> pnpm test:node` for env=`node`
  - `MATRIX_CHAIN=<chain> pnpm test:web` for env=`web`
  - `MATRIX_CHAIN=<chain> pnpm test:all` for both, or when no env is given
  - Omit `MATRIX_CHAIN` entirely to mean `<chain>` = `all` — note `staging` and
    `localcofhe` are opt-in and only run when named explicitly or via `all`, not when
    the variable is simply unset with no chain named at all
  - Valid chains/groups: `hardhat`, `localcofhe`, `sepolia`, `arb-sepolia`,
    `base-sepolia`, `staging`, `testnet` (= sepolia+arb-sepolia+base-sepolia), `all`
    (see `test/integration-matrix/src/matrix.ts`)

## Parsing

Strip connector/filler words (`then`, `and`, `run`, `please`, `now`, `next`, `the`) and
split on whitespace. Match remaining tokens left to right:

1. `build` or `setup` → that step, standalone.
2. Otherwise, treat the token as a chain name; if the following token is `node` or
   `web`, consume it as that chain's env, else default to both (`test:all`).

Run the parsed steps sequentially in the order given — later steps often depend on
earlier ones (e.g. `setup` must finish before a matrix run reads the freshly deployed
contract address; `build` should precede a matrix run that needs the latest SDK).

## Execution notes

- Request `full_network` permission for `setup` and any matrix run — both hit real
  testnets/staging.
- `setup` and matrix runs can take 10–90s; use a generous `block_until_ms` (60–90s) or
  background long staging runs.
- If a step fails, stop and report before running later steps — don't layer a matrix
  run on top of a failed `setup`.
- After running, summarize pass/fail counts per suite; don't just dump raw log tails.

## Examples

- `/matrix-test staging node` → `MATRIX_CHAIN=staging pnpm test:node` in
  `test/integration-matrix`.
- `/matrix-test setup` → `pnpm test:setup` at repo root.
- `/matrix-test build` → `pnpm --filter @cofhe/sdk build` at repo root.
- `/matrix-test build setup then run staging node` → build, then setup, then
  `MATRIX_CHAIN=staging pnpm test:node`, in that order.
- `/matrix-test testnet` → `MATRIX_CHAIN=testnet pnpm test:all` (node + web).
