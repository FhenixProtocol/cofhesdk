---
'@cofhe/sdk': minor
---

Removes `createCofheClientBase` and `createCofheConfigBase` from the exports of `@cofhe/sdk`. They were internal building blocks and were never documented. Use `createCofheClient` and `createCofheConfig` from `@cofhe/sdk/node` or `@cofhe/sdk/web`, which take the same config.
