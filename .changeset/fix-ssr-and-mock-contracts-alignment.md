---
'@cofhe/sdk': patch
'@cofhe/mock-contracts': patch
---

Fix SSR compatibility (`@cofhe/sdk/web` no longer crashes Next.js builds with `self is not defined`) by lazy-loading `tfhe`. Align `@cofhe/mock-contracts` with `@fhenixprotocol/cofhe-contracts@^0.1.3` (updated `TestBed.sol` to use current decrypt API, added missing `ITaskManager` batch methods to `MockTaskManager.sol`).
