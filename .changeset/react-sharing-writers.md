---
'@cofhe/react': minor
'@cofhe/sdk': minor
---

The React sharing writers (`useCofheShareOnChain`, `useCofheRemoveShare`, `useCofheRevokeACP`) send through the SDK's write pipeline: the transaction is simulated first, recorded in the transaction store under the new built-in action types `shareAcp`, `removeShare` and `revokeAcp` (shown in Activity), and once mined the registry reads and the inbox, or the ACP status for a revoke, are refetched. `client.acp.prepareShareOnChain`, `prepareRemoveShare` and `prepareRevokeACP` build the same writes without sending them.
