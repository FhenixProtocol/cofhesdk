---
'@cofhe/react': minor
---

Public token balances and token allowances now live under the standard `cofheReadContract` key grammar instead of their bespoke `['tokenBalance', …]` / `['tokenAllowance', …]` families — they are ordinary contract reads (`balanceOf(account)`, `allowance(owner, spender)`), and now they are keyed like it: `[...readPrefix(token, fn), [args]]`, with checksummed addresses. A plain `useCofheWriteContract` invalidation descriptor (`{ address: token, functionName: 'balanceOf' | 'allowance' }`, args-narrowable) reaches them with no special vocabulary; the native ETH balance becomes a documented pseudo-read keyed at the ETH sentinel address, so `{ address: ETH_SENTINEL, functionName: 'balanceOf' }` targets it too. `constructPublicTokenBalanceQueryKey*` / `constructTokenAllowanceQueryKey*` keep their signatures and emit the new keys; existing cached entries under the old keys are simply abandoned to garbage collection.

Alongside this, the address segment of EVERY `cofheReadContract` key is now canonicalized (best-effort checksummed) inside `constructCofheReadContractQueryForInvalidation`, which both the read-key builders and `useCofheWriteContract`'s invalidation descriptors flow through — so a read key and an invalidation target can never disagree on address case again. Consumers no longer need to pre-checksum addresses on either side.
