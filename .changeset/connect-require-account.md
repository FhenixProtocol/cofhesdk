---
'@cofhe/sdk': minor
---

Changes `connect` to reject a wallet client without an `account`, with `WALLET_CLIENT_ACCOUNT_MISSING`. Previously it connected using the wallet's first address, then creating, importing, sharing or revoking an ACP threw `Missing walletClient…` and `acp.getIncomingShares` threw a property access error.

Deprecates `PUBLIC_WALLET_GET_ADDRESSES_FAILED`: `connect` no longer asks the wallet for its addresses, so it is never thrown.
