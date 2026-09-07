---
'@cofhe/react': minor
---

Chain-pinned reads: `useCofheReadContract` and `useCofheReadContracts` accept `chainId` to pin a read (or a whole batch) to a specific chain instead of following the connected one. The pinned id becomes the key's chain segment — pin your `invalidates` targets to the same `chainId` so they meet — and the fetch goes through an app-supplied client for that chain, declared via `CofheProvider`'s new `publicClients?: Record<number, PublicClientLike>` prop (`useCofhePublicClient(chainId?)` resolves it). Without a client for the pinned chain the read stays disabled rather than silently querying the wrong chain. This closes the dual-chain footgun where parking the wallet on one chain broke every read of an app whose contracts live on another.
