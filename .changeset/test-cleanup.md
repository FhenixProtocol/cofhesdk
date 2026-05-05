---
'@cofhe/sdk': minor
'@cofhe/mock-contracts': minor
'@cofhe/hardhat-plugin': minor
'@cofhe/hardhat-3-plugin': minor
---

Remove the legacy `TestBed` mock surface and stop auto-deploying `SimpleTest` through the Hardhat plugins. Core mock contracts still deploy automatically, while tests that need `SimpleTest` should deploy it explicitly from their own artifacts.

This also removes `TEST_BED_ADDRESS` and cleans up duplicate `SimpleTest` exports from `@cofhe/mock-contracts`.
