---
'@cofhe/abi': patch
---

`transformEncryptedReturnTypes` now handles arrays of structs (`tuple[]` / `tuple[N]`): each element is transformed as its own tuple, with fixed-size lengths enforced. Previously the array itself was processed as a single tuple — the named-component lookups found nothing and the whole result collapsed to `{}`, breaking any read whose return type is a struct array (e.g. a batch getter returning `Order[]` through `useCofheReadContract`). A stray `console.log` in the transform was also removed.
