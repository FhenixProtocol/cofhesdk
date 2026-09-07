---
'@cofhe/mock-contracts': patch
'@cofhe/sdk': patch
---

Paginate `ACPShareRegistry.sharesFor` so oversized share lists cannot grief the inbox / blow gas, and keep the SDK helpers aligned with the paginated mock.
