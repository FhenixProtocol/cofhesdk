---
'@cofhe/react': minor
---

The sharing hooks are exported: `useCofheIncomingShares` (registry inbox, polled; shares already imported by the connected account are left out), `useCofheShareOnChain`, `useCofheImportShared({ activate })` (exported JSON or an `IncomingShare`), `useCofheRemoveShare`, `useCofheRevokeACP` and `useCofheACPStatus` (an ACP on-chain status, re-read after a revoke mines). The write hooks resolve once mined. The package-internal names (`useIncomingShares`, `useShareOnChain`, `useImportFromChain`, `useRemoveShare`) stay as deprecated aliases.
