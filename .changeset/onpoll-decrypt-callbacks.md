---
"@cofhe/sdk": minor
"@cofhe/react": minor
"@cofhe/site": minor
---

Add `onPoll` callback support for decrypt polling (tx + view) so consumers can observe poll progress.

- SDK decrypt helpers accept `onPoll` and emit `{ operation, requestId, attemptIndex, elapsedMs, intervalMs, timeoutMs }` once per poll attempt.
- React wiring supports passing the callback end-to-end.
- Docs updated with usage examples.
