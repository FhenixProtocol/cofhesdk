---
"@cofhe/hardhat-plugin": patch
---

fix(hardhat-plugin): keep `config.cofhe` when `networks.localcofhe` is user-defined

`extendConfig` no longer early-returns on a custom `localcofhe` network, so sepolia presets and `config.cofhe` are still applied (aligned with `@cofhe/hardhat-3-plugin`).
