---
'@cofhe/sdk': patch
---

`createCofheConfig` now rejects unknown keys inside `mocks` and `acp`, as it already does at the top level. Previously they were dropped without an error, so a config that still used the pre-0.3 `mocks.sealOutputDelay` (now `decryptDelay`), or a typo such as `acp.defaultRevokers`, silently ran on the defaults.
