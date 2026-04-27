---
'@cofhe/sdk': patch
---

Add submit retries to the threshold-network decrypt flows used by both `decryptForTx` and `decryptForView` when the backend responds with `204 No Content` before a `request_id` is available.

- When the submit endpoint returns `204` without a body, the SDK now retries until it receives a `request_id` or the existing poll timeout budget is exhausted.
- These submit retries now emit `onPoll` callbacks, so consumers can observe retry progress before a request id exists.
- Submit retries and status polling now share the same overall timeout budget.
