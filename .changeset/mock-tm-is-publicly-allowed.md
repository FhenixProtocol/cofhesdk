---
'@cofhe/mock-contracts': patch
---

`MockTaskManager.isPubliclyAllowed` now returns whether a handle was made public with `FHE.allowGlobal` / `FHE.allowPublic`, like the TaskManager, instead of reverting with `NotImplemented`.
