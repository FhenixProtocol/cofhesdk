---
'@cofhe/mock-contracts': patch
---

`FHE.not` on encrypted integers is now a bitwise NOT in the mocks (`not(euint8(2))` is 253, not 0), and `FHE.rol` / `FHE.ror` now rotate within the type's width, with the amount taken modulo the width, instead of shifting. This matches TFHE-rs.
