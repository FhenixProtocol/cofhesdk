---
'@cofhe/react': patch
---

New `useCofheACPs({ chainId?, type? })`: the connected account stored ACPs on a chain (the connected chain by default), optionally narrowed to one type, e.g. `useCofheACPs({ type: 'recipient' })` for received shares. `useCofheAllACPs` is deprecated: it returned only the connected account ACPs on the connected chain, not all ACPs, and is now an alias of `useCofheACPs()`.
