---
'@cofhe/sdk': patch
---

Stops Next.js 16 Turbopack `next build` from hanging when a client component imports `@cofhe/sdk/web`. The lazy `import('tfhe')` (and the proof-worker URL) are marked with `webpackIgnore` so Turbopack no longer tries to analyse/bundle `tfhe` at build time. Documents the `--webpack` workaround for older SDK versions.
