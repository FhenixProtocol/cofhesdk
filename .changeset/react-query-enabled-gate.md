---
'@cofhe/react': patch
---

`useCofheTokenClaimable`, `useCofheTokenClaims` and `useResolvedCofheToken` keep their own `enabled` conditions when `queryOptions.enabled` is set. Previously `enabled: true` replaced them, so the query ran without a connected account or public client and failed.
