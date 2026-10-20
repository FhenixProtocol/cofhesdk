---
'@cofhe/react': minor
'@cofhe/sdk': minor
---

**@cofhe/react**

- `useCofheShareOnChain`, `useCofheRemoveShare` and `useCofheRevokeACP` now send through `useCofheWriteContract`, like the other SDK writes: a write the registry or the revoker would reject fails on the hook before anything is sent, and each write shows in the floating button's Activity. Previously they sent directly, with no simulation and no Activity row.
- New built-in action types `shareAcp`, `removeShare` and `revokeAcp`. A `Record` or exhaustive `switch` over `BuiltInTransactionActionType` needs the three new cases.

**@cofhe/sdk**

- New `client.acp.prepareShareOnChain`, `prepareRemoveShare` and `prepareRevokeACP` build these writes without sending them, for apps that send through their own transaction path. [Docs](https://cofhesdk.fhenix.io/sdk/acp#post-a-share)
