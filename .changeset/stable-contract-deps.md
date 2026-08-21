---
'@cofhe/mock-contracts': patch
'@cofhe/foundry-plugin': patch
'@cofhe/hardhat-plugin': patch
---

**Pin `@fhenixprotocol/cofhe-contracts` to the stable `0.2.0`.** 0.7.0 shipped against the
`0.2.0-beta.3` prerelease; `0.2.0` is now released and is what `fhenix-confidential-contracts@0.4.0`
depends on exactly, so keeping the beta pin resolved two copies of `FHE.sol` in any project using
both. Nothing consumer-facing is removed between the two — `isAllowed` becomes `view` (which the
mocks already were), and `FHE.div`/`rem` on `euint64` plus `FHE.mul`/`div`/`rem`/`square` on
`euint128` are added. The `@cofhe/hardhat-plugin` peer range moves to `>=0.2.0`.
