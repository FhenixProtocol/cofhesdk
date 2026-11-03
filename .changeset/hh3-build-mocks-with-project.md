---
'@cofhe/hardhat-3-plugin': patch
---

Corrects `@cofhe/hardhat-3-plugin` to keep the mock contract artifacts through a full `hardhat build`. Previously the build deleted the artifacts the plugin compiles at startup, and parallel `hardhat test` workers compiled them again while other workers read the build info, so test files could fail with `Failed to parse build info`.
