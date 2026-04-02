---
'@cofhe/react': patch
'@cofhe/sdk': patch
---

Improve logging ergonomics across React + web SDK.

- Add a configurable internal logger to `@cofhe/react` via `createCofheConfig({ react: { logger } })`.
- Make `@cofhe/sdk` `createWebStorage` logging opt-in via `createWebStorage({ enableLog })`.
