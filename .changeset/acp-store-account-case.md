---
'@cofhe/sdk': patch
---

ACP store lookups now match the account address case-insensitively. Previously an account passed in a different case than the one it was stored under (for example a lowercased address from an indexer or URL, while ACPs are saved under the wallet's checksummed address) was not found: `decryptForView(...).setAccount(addr)` failed with `ACPNotFound`, and `getOrCreateSelfACP` created a new ACP and asked the wallet for a new signature on every call. Accounts keep the spelling they were first stored under, so existing persisted data and the `@cofhe/react` hooks are unaffected.
