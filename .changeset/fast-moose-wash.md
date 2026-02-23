---
'@cofhe/hardhat-plugin': minor
'@cofhe/mock-contracts': minor
'@cofhe/example-react': minor
'@cofhe/react': minor
'@cofhe/sdk': minor
---

Remove `sdk` from function names and exported types. Rename:

- `createCofhesdkConfig` -> `createCofheConfig`
- `createCofhesdkClient` -> `createCofheClient`
- `hre.cofhesdk.*` -> `hre.cofhe.*`
- `hre.cofhesdk.createCofheConfig()` → `hre.cofhe.createConfig()`
- `hre.cofhesdk.createCofheClient()` → `hre.cofhe.createClient()`
- `hre.cofhesdk.createBatteriesIncludedCofheClient()` → `hre.cofhe.createClientWithBatteries()`
