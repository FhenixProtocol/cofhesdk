---
'@cofhe/mock-contracts': patch
---

`MockTaskManager` no longer skips the ACL for handles it thinks are trivially encrypted. The check read the security zone's sign bit instead of the trivial flag, so every handle in a negative security zone was treated as public: any contract could use it, `isAllowed` returned true, and `FHE.allow*` did nothing. The TaskManager has no such bypass, and the mock now always goes through the ACL.
