---
'@cofhe/mock-contracts': patch
---

`FHE.rem(x, 0)` in `MockCoFHE` now returns `x` like TFHE-rs instead of reverting with a division by zero panic.
