# Chain tests

Hook tests that need a chain. Each file renders real hooks in Chromium against an Anvil node that has the CoFHE mocks and the test contracts on it. `anvil.setup.ts` starts the node through `@cofhe/test-anvil` and hands the contract addresses to the files, which read them with `inject()`.

The files run in parallel against that one node, so a file shares nothing it writes to. Each takes its accounts from `freshAccount()` and, if it writes to a SimpleTest, deploys its own with `deploySimpleTest()`; both are in `fixtures.ts`. A new file needs no account or contract set aside for it.

```bash
pnpm test           # both projects
pnpm test:unit      # the mocked hook tests under src/, about ten seconds
pnpm test:chain     # this project only
```

`anvil` and `forge` must be on `$PATH`, and the Playwright Chromium must be installed (`pnpm exec playwright install chromium`).

The files import `@cofhe/react` by name, the way an app does. The vitest config points that at `src/`, so the tests run on the source, not on `dist/`.

These tests ran in `@cofhe/integration-matrix` before. They never ran on a testnet, only on Anvil, so they moved here, where they run without the testnet keys.
