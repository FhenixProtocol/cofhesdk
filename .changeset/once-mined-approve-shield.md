---
'@cofhe/react': patch
---

Adds `onceMined` and `isMining` to `useCofheTokenApprove` and `useCofheTokenShield`, as `useCofheTokenUnshield` already has them: `onceMined` fires once when the transaction mines, with its final status, and `isMining` is true from the hash until then. An approval needs the `extras` on the write, which is what records it in the transaction store.
