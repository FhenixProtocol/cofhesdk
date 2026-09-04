---
'@cofhe/react': patch
---

`@tanstack/react-query` is now a peer dependency of `@cofhe/react` (`^5.90.20`)
instead of a hard dependency pinned to an exact version.

**Action required for consumers:** declare `@tanstack/react-query` in your own
dependencies if you do not already. Most apps do, via wagmi — which has always
declared it as a peer — so in practice nothing changes for them except that the
duplicate copy disappears.

Previously every consumer ended up with a _second_ react-query runtime: their own,
plus the one shipped inside `@cofhe/react`. Two module instances mean two sets of
React contexts, and anything this package exports that is typed in terms of
react-query becomes unusable from consumer code, because the type identities
differ across the two copies — `withInvalidationContext` being the notable case.

Also raises the floor to `^5.90.20`, which `@tanstack/react-query-persist-client@5.90.22`
(still a normal dependency here) already required; the previously-pinned `5.90.7`
never satisfied it. Note react-query has no `5.90.20+` release — the range is first
satisfiable at `5.91.3`.
