---
'@cofhe/sdk': patch
---

fix(sdk): don't treat Object.prototype keys as known backend error codes

`isBackendApiErrorCode` used `value in BACKEND_ERROR_CODE_TO_COFHE_ERROR_CODE`, and `in` also matches inherited keys. So a backend `error` of `toString`, `constructor`, `valueOf` or `hasOwnProperty` was treated as recognised and `mapApiErrorCodeToCofheErrorCode` returned the inherited value — a function — instead of the documented fallback. `CofheError.code` then held a non-string, so `err.code === CofheErrorCode.X` comparisons silently failed.

Switched to an own-property check. Recognised codes and ordinary unknown codes are unaffected.
