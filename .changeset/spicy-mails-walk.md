---
'@cofhe/hardhat-plugin': minor
'@cofhe/mock-contracts': minor
'@cofhe/eslint-config': minor
'@cofhe/example-react': minor
'@cofhe/react': minor
'@cofhe/sdk': minor
---

Adds `environment: 'node' | 'web' | 'hardhat' | 'react'` option to config. Exposed via `client.config.enviroment`. Automatically populated appropriately within the various `createCofhesdkConfig` functions.
