---
'@cofhe/react': minor
---

`useCofheWriteContract`'s `invalidates` option now also accepts a function of the mined receipt — `invalidates: (receipt) => targets` — for writes whose targets are only known from the outcome (e.g. an id read out of the event logs). Invalidation still fires once mined, block-aware, for any mined outcome. Invalidation descriptors additionally accept `args` (together with `functionName`) to narrow a target to one exact call — `{ address, functionName: 'getOrder', args: [orderId] }` refreshes just that read, leaving other args of the same function untouched. New exported type: `CofheWriteInvalidates`.
