---
'@cofhe/sdk': patch
---

`@cofhe/sdk/acps` exports the on-chain sharing pieces: `ACP_SHARE_REGISTRY_ABI`, `ACP_REVOKER_ABI`, `ACP_SHARE_TUPLE_ABI`, `toChainShare`, `computeShareId`, `shareIdOfChainShare`, `getAclAddress`, `getAclServedAddresses` and `clearAclServedAddresses`, so an app can send registry and revoker writes through its own transaction path and still agree with the registry on share ids.
