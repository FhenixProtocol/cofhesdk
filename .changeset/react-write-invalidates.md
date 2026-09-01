---
'@cofhe/react': minor
---

`useCofheWriteContract` accepts a new `invalidates` option — read queries to refresh once the write is mined, e.g. `useCofheWriteContract({ invalidates: [{ address, functionName: 'balanceOf' }] })` (`chainId` defaults to the connected chain; omit `functionName` to refresh every read of the contract). Invalidation waits for the transaction receipt and passes the mined block's hash as invalidation context, so the triggered refetches only trust an RPC node that already knows that block; reverted transactions invalidate nothing. Raw query keys and full invalidation filters are also accepted.

Newly exported from the package root: `useCofheReadContract`, `constructCofheReadContractQueryForInvalidation`, and the `UseCofheReadContractResult`, `UseCofheReadContractQueryOptions`, `useCofheWriteContractOptions`, `CofheWriteInvalidationTarget`, `CofheReadInvalidationDescriptor` types.
