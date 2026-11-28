---
'@cofhe/mock-contracts': patch
'@cofhe/sdk': patch
'@cofhe/foundry-plugin': patch
---

**@cofhe/mock-contracts**

Changes `MockThresholdNetwork.querySealOutput` to take `(ctHash, acp)`, without the second argument it never read, and marks `MockThresholdNetwork` as internal to the SDK and plugins. Removes `MockThresholdNetwork.queryDecrypt`, which nothing called. Upgrade all `@cofhe/*` packages together and restart any local node with mocks deployed: an older SDK fails against the new mock with "function selector was not recognized".

**@cofhe/sdk**

Changes `decryptForView` on the mocks chain to call `querySealOutput(ctHash, acp)`. Needs `@cofhe/mock-contracts` of the same version.

**@cofhe/foundry-plugin**

Changes `CofheClient.decryptForView` to call `querySealOutput(ctHash, acp)`. Needs `@cofhe/mock-contracts` of the same version.
