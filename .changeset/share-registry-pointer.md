---
'@cofhe/sdk': minor
'@cofhe/mock-contracts': minor
---

On-chain sharing follows the pointer-based `ACPShareRegistry`: `share(acp, metadata)` emits the full payload and an opaque metadata blob in the `Shared` event (share id now an indexed topic) and stores only the share header (issuer, expiration, recipient, revoker, block of the event). `sharesFor` returns `(shareIds, headers)` and `getShare` a header; `ACP_SHARE_REGISTRY_ABI` changes accordingly. `getIncomingShares` reads the headers, then the events with one single-block `getLogs` per block (`readSharesFor`, `readShare`, `readPostedShares` in `@cofhe/sdk/acps`). `IncomingShare` gains `metadata`; `client.acp.getShareFromChain(shareId)` reads one share. The registry is upgraded in place on every network (cofhe-contracts `task:upgradeShareRegistry`, same address); shares posted before the upgrade are not carried over. This SDK needs that upgrade, and earlier SDKs cannot post or list shares after it.
