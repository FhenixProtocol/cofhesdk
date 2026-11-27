---
'@cofhe/react': patch
---

Corrects `useResolvedCofheToken` to recognize ERC-20 and native wrappers built from fhenix-confidential-contracts 1.0.0. Previously it threw `Address is not a supported CoFHE token` for them, because they report interface id `0x216f1651` / `0xff75cc20`, not `0x4d52d826` / `0xaefc9bc7`.
