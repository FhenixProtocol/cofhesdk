---
'@cofhe/sdk': minor
'@cofhe/react': minor
'@cofhe/mock-contracts': minor
'@cofhe/foundry-plugin': minor
'@cofhe/hardhat-plugin': minor
'@cofhe/hardhat-3-plugin': minor
---

Resolve the Task Manager through the `CoFHEAddressBook` (`@fhenixprotocol/cofhe-contracts@1.0.0`). **Breaking:** `TASK_MANAGER_ADDRESS` is removed from `@cofhe/sdk`. Use `getTaskManagerAddress(publicClient)`, which reads `getTm(TASK_MANAGER_ID)` from the book at `COFHE_ADDRESS_BOOK_ADDRESS` (both exported) and caches the result per chain. If the chain has no book, or the id is unset, it throws `TASK_MANAGER_UNRESOLVED`. `verifyDecryptResult`, the ACL/ACP lookups and `useCofheEnabled` / `useCofheReadDecryptionResults` now resolve the Task Manager this way. `@cofhe/react` adds `useCofheTaskManagerAddress()`.

Mocks: a new `MockCoFHEAddressBook` is deployed at FHE.sol's `COFHE_ADDRESS_BOOK`, and `MockTaskManager` moves to `MOCKS_TASK_MANAGER_ADDRESS` (`0x…5000`) and is registered in the book. `MockACL` now stores its Task Manager (`setTaskManager` / `getTaskManagerAddress`) instead of reading a constant, so its `TASK_MANAGER_ADDRESS_()` getter is gone. All three plugins deploy and wire the book. Hardhat 2 exposes `hre.cofhe.mocks.getMockCoFHEAddressBook()`, Hardhat 3 exposes `conn.cofhe.mocks.MockCoFHEAddressBook`, and Foundry exposes `CofheTest.mockAddressBook`. Contracts must be built against `@fhenixprotocol/cofhe-contracts@1.0.0` or later (the hardhat plugin's peer range is now `>=1.0.0`). Each FHE op now makes one extra `getTm` call on the book, as it does on real networks, so expect slightly higher gas numbers.
