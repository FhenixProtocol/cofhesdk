---
'@cofhe/sdk': minor
---

Corrects `client.acp` to create ACPs that expire `defaultACPExpiration` seconds after the latest block, and to check stored and imported ACPs for expiry against that block. Previously the option was ignored (every ACP lasted 7 days by the local clock), and after a Hardhat `time.increase` the client kept reusing an expired ACP, so decrypts failed as expired.

Adds an optional `nowSec` argument to `ValidationUtils.isExpired`, `isSignedAndNotExpired` and `isValid`, and to their `ACPUtils` counterparts. The `defaultACPExpiration` default changes from 30 to 7 days, the lifetime ACPs already had, and a value that is not a positive whole number of seconds is now rejected.
