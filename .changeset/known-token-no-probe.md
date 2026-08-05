---
'@cofhe/react': minor
---

feat(react): useKnownCofheToken; useCofheToken no longer probes on-chain

New `useKnownCofheToken({ chainId, address })`: resolves a token address against what the
client already knows — configured tokenlists, imported (custom) tokens, and the chain's
default token. Never touches the chain; unknown resolves to `undefined`.

`useCofheToken` no longer falls back to `useResolvedCofheToken`'s on-chain interface probe
for unlisted addresses. The silent fallback was incorrect: it also fired for known tokens
during the tokenlist-loading window and probed the connected chain regardless of the
requested `chainId`, producing spurious "Address is not a supported CoFHE token" failures
for stale or wrong-chain addresses. It now delegates to `useKnownCofheToken` (its options
parameter is deprecated and unused). Consumers that genuinely want on-chain resolution
must call `useResolvedCofheToken` explicitly.
