---
'@cofhe/sdk': patch
---

The persisted ACP store is now reset when `acps` or `activeACPHash` was saved as `null` or an array. Previously a saved `null` passed the structure check and was rehydrated as-is, so reading or creating ACPs (`getACP`, `getACPs`, `setACP`, …) and the `@cofhe/react` ACP hooks threw a `TypeError` until the browser storage was cleared. The shape is now repaired on load as well as before each store access.
