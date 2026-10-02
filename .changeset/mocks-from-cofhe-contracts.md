---
'@cofhe/mock-contracts': minor
'@cofhe/hardhat-plugin': minor
'@cofhe/hardhat-3-plugin': minor
'@cofhe/foundry-plugin': minor
---

The ACP contracts in the mocks are cofhe-contracts' own instead of hand-made copies: `ACPShareRegistry.sol`, `ACPTimestampRevoker.sol` and `Permissioned.sol` are copied verbatim from a pinned cofhe-contracts commit (`contracts/cofhe-contracts.json`; `pnpm update:cofhe-contracts <commit>` refreshes them, and build and test fail if a copy is edited). `MockPermissioned` moves to `MockPermissioned.sol`, on top of the real `PermissionedUpgradeable`. The share registry is the upgradeable production contract, so the plugins deploy it behind `MockERC1967Proxy` and initialize it with the deployer as admin. The mocks now need Solidity 0.8.25 or later and `@openzeppelin/contracts-upgradeable` (a new peer dependency of the Hardhat plugin; foundry users add its remapping).
