---
'@cofhe/hardhat-plugin': patch
---

Defining your own `networks.localcofhe` no longer skips the rest of the plugin's config setup. The Sepolia presets and `config.cofhe` are still applied, matching `@cofhe/hardhat-3-plugin`; previously reading `hre.config.cofhe` would crash.
