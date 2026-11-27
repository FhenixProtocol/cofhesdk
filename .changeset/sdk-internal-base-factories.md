---
'@cofhe/sdk': patch
---

Changes the docs of `createCofheClientBase` and `createCofheConfigBase` to mark them internal and name the replacement: `createCofheClient` and `createCofheConfig` from `@cofhe/sdk/node` or `@cofhe/sdk/web`. Previously TypeScript suggested `createCofheClientBase` for a `createCofheClient` imported from `@cofhe/sdk`, with no hint it was the wrong one.
