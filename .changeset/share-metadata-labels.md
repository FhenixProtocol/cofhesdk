---
'@cofhe/sdk': minor
---

Share metadata: a SNAPSHOT share can carry one label per handle saying where the value came from — a stored value (a view call at a block) or an event value (one log: block, transaction, log index, event selector). `client.acp.shareOnChain(acp, { labels })` posts them with the share; `client.acp.verifyShareLabels(share, { verify: 'all' | 'events' | 'none' })` checks them against the chain; `describeShareMetadata(blob, handles, abis)` turns them into function and event names and params. Also exported from `@cofhe/sdk/acps`: `encodeShareMetadata`, `decodeShareMetadata`, `verifyShareLabel(s)`, `describeShareLabels`, `eventLabelOfLog`, `confidentialBalanceLabel`.
