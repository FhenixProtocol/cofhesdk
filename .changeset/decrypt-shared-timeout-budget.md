---
'@cofhe/sdk': patch
---

Add `CT_NOT_READY` submit retries to the threshold-network decrypt flows used by both `decryptForTx` and `decryptForView`.

- When the submit endpoint returns `CT_NOT_READY`, the SDK now retries until it receives a `request_id` or the existing poll timeout budget is exhausted.
- These submit retries now emit `onPoll` callbacks, so consumers can observe retry progress before a request id exists.
- Submit retries and status polling now share the same overall timeout budget.
