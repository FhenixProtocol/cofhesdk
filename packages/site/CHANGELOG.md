# @cofhe/site

## 0.7.1

## 0.7.0

### Patch Changes

- f01cac7: Decrypt/sealoutput failures now map the threshold network's stable `error` codes to dedicated `CofheErrorCode` values (e.g. `ACPDenied`, `CtNotFound`, `UnsupportedType`) instead of a generic `DecryptFailed`/`SealOutputFailed`, and `CofheError` gains an `apiErrorCode` field with the raw backend string.

  Also fixes submit-time `404` retries: a `404` is only retried while the backend reports `ct_not_found` (still indexing); any other error code now fails immediately instead of being blindly retried for up to `set404RetryTimeout`.

## 0.6.1

## 0.6.0

## 0.5.2

### Patch Changes

- 2fbb918: Retry transient submit-time `404 Not Found` responses in the threshold-network decryption flows used by `decryptForTx` and `decryptForView`.

  This adds a configurable `.set404RetryTimeout(timeoutMs)` builder option, defaults the retry window to 10 seconds, and keeps `decrypt` and `sealoutput` submit retry behavior aligned.

  Update the decryption docs to explain submit-time `404` retries, empty `requestId` values during request creation, and when to increase the retry timeout for slower backends.

## 0.5.1

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
