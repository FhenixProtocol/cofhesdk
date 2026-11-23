---
'@cofhe/sdk': patch
---

Corrects `createCofheConfig` to reject unknown keys inside `mocks` and `acp`, as it already does at the top level. Previously they were dropped without an error, so a config still using the pre-0.3 `mocks.sealOutputDelay` (now `decryptDelay`) silently ran with a `decryptDelay` of 0.
