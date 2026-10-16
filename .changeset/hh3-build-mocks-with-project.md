---
'@cofhe/hardhat-3-plugin': patch
---

The mock contracts are now part of every full `hardhat build` (`solidity.npmFilesToBuild`), so the build no longer deletes the mock artifacts the plugin compiles at startup. Previously each full build removed them, and parallel `hardhat test` workers compiled them again while other workers were reading the build info, which could fail test files with "Failed to parse build info".
