---
'@cofhe/hardhat-3-plugin': patch
---

Connecting to a chain that already has the mocks deployed (for example a shared `hardhat node`) now reuses them instead of deploying a new set. Redeploying swapped in a fresh MockACL, so contracts deployed by an earlier connection lost access to their own handles and reverted with `ACLNotAllowed`. `deployMocks` takes a new `reuseExisting` option for this; calling it without the option still deploys a fresh set.
