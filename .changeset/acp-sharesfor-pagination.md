---
'@cofhe/mock-contracts': patch
'@cofhe/sdk': patch
---

Cap `ACPShareRegistry.sharesFor` with pagination (`MAX_SHARES_PAGE` / `sharesForPage`) so an unbounded inbox cannot grief discovery gas, and expose matching SDK helpers.
