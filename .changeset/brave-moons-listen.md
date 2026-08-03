---
'@cofhe/sdk': patch
---

Fix `clearStaleStore` accepting `null` and array values as valid store structures. `typeof null === 'object'` meant a persisted store with `permits: null` passed the guard, causing a `TypeError` on the next `getPermit` call.
