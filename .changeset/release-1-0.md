---
'@cofhe/sdk': major
---

1.0.0, the first stable release. Breaking changes since 0.8, detailed in their own entries below:

- The on-chain share registry has a new layout (`share(acp, metadata)`, header-only `sharesFor` / `getShare`), and shared ACPs no longer carry a `name`.
- The mocks need Solidity 0.8.25 or later and `@openzeppelin/contracts-upgradeable`.
- `CofheProvider` takes either `config` or `cofheClient`, not both.
