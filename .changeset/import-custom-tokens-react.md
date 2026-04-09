---
'@cofhe/react': minor
---

Add custom token import support to the React widget token picker.

- Let users import CoFHE tokens by contract address directly from the token list and portfolio flows.
- Persist imported tokens per chain in local storage and merge them into `useCofheTokens()` results.
- Resolve token metadata and CoFHE compatibility on demand before importing, including wrapped-token pair metadata when available.
