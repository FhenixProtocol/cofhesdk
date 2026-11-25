---
'@cofhe/sdk': minor
---

Changes `encryptInputs` in the browser so that the Web Worker does all the heavy work: it starts TFHE, fetches, validates and stores the FHE key and the CRS, and proves. The page's thread no longer starts TFHE or handles the keys, so the first encrypt of a page no longer freezes it either.

- On the worker path the keys are kept in the worker's own IndexedDB store, per origin. `fheKeyStorage` now only applies when the page's thread proves (Web Workers off, or after a worker failure).
- A worker failure in any step, not only in proving, falls back to the page's thread, which reuses the keys the worker stored.
- `onStep` now reports the fallback's steps too: after a worker failure, `InitTfhe`, `FetchKeys`, `Pack` and `Prove` start again on the page's thread, and each of those events carries `workerFailedError`. The failed worker step has no end event.
- Every event of those four steps carries `inWorker`. `EncryptStepCallbackContext` documents each field; `packedInWorker` and `usedWorker` are deprecated in favour of `inWorker` and keep their values.
- Removes the internal test helper `createCofheClientWithCustomWorker` and the worker message types `ZkProveWorkerFunction`, `ZkProveWorkerRequest` and `ZkProveWorkerResponse`. An app that supplied its own worker through that helper should use `createCofheClient`, whose built-in worker now covers it.
- Removes `fetchKeys` from `@cofhe/sdk/core`. It was undocumented and nothing in the SDK used the export; `encryptInputs` fetches the keys by itself.
- On the page's thread, a chain without a CoFHE URL now fails the `FetchKeys` step with `MissingConfig` (it was wrapped as `FetchKeysFailed`), the same as on the worker path.
- Changes the parameters of the internal `createCofheClientBase`: the platform's proving parts are now passed grouped, as `proving: { mainThread, worker }`, instead of as a flat list. Apps use `createCofheClient` and are not affected.
