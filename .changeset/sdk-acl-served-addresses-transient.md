---
'@cofhe/sdk': patch
---

`getAclServedAddresses` no longer caches the result when reading the ACL's `defaultRevokerContract` or `shareRegistry` fails with a network error. A rate limit or timeout during the first lookup used to leave new ACPs without the default revoker and on-chain sharing without a registry until the page was reloaded.
