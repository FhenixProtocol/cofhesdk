---
'@cofhe/sdk': patch
---

Corrects `createSelf` and `createSharing` to reject an `issuer` that is not the connected account. Previously the ACP was signed by the connected account anyway and, for `createSelf`, replaced the active ACP, so the next decrypt reverted with `PermissionInvalid_IssuerSignature`.
