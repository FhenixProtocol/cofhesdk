# @cofhe/site

## 0.5.1

### Patch Changes

- Document `404` submit retries for `decryptForTx` / `decryptForView` and the new `.set404RetryTimeout(timeoutMs)` builder option.

## 0.5.0

### Minor Changes

- 788a6e2: Add `onPoll` callback support for decrypt polling (tx + view) so consumers can observe poll progress.

  - SDK decrypt helpers accept `onPoll` and emit `{ operation, requestId, attemptIndex, elapsedMs, intervalMs, timeoutMs }` once per poll attempt.
  - React wiring supports passing the callback end-to-end.
  - Docs updated with usage examples.

## 0.4.0

### Minor Changes

- b99691c: Document cofhe sdk core and hardhat

## 0.2.2

### Patch Changes

- 370f0c7: no-op
