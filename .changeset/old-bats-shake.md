---
"@cofhe/hardhat-plugin": patch
"@cofhe/mock-contracts": patch
---

Fix ACL permission invalid issue. MockACL needs real deployment since etching doesn't call the constructor, so the EIP712 is uninitialized. Also adds additional utility functions to hardhat-plugin:
- `hre.cofhesdk.connectWithHardhatSigner(client, signer)` - Connect to client with hardhat ethers signer.
- `hre.cofhesdk.createBatteriesIncludedCofhesdkClient()` - Creates a batteries included client with signer connected.
- `hre.cofhesdk.mocks.getMockTaskManager()` - Gets deployed Mock Taskmanager
- `hre.cofhesdk.mocks.getMockACL()` - Gets deployed Mock ACL
