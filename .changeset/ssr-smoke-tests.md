---
'@cofhe/sdk': patch
'@cofhe/react': patch
---

Add SSR smoke tests for `@cofhe/sdk/web` and `@cofhe/react` that run in a Node environment (no `window`/`document`). The tests catch regressions that crash Next.js server-side rendering, such as eager WASM imports and unguarded `window` access at module load time. `@cofhe/react` now has a Vitest config and a real `test` script in place of the previous no-op.
