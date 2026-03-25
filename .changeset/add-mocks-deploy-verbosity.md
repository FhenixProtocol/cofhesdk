---
"@cofhe/hardhat-plugin": minor
---

Add `@cofhe/hardhat-3-plugin` and `@cofhe/foundry-plugin` packages.

**`@cofhe/hardhat-3-plugin`** — Hardhat 3 plugin with the same mock contract deployment, `network.cofhe` API, logging, and faucet task as the v2 plugin, adapted to the Hardhat 3 plugin/hook model.

**`@cofhe/foundry-plugin`** — Foundry test utilities: `CofheTest` base contract (`deployMocks`, `expectPlaintext`, `getPlaintext`) and `CofheClient` SDK mock (`connect`, `createInE*`, `decryptForTx`, `decryptForView`, permits). Usable as a git submodule or npm package, with `remappings.txt` for Hardhat 3 Solidity test compatibility.

**`mocksDeployVerbosity` config option** added to both Hardhat plugins:
- `''` — silent
- `'v'` — single summary line (new default)
- `'vv'` — full per-contract deployment logs (previous default behavior)
