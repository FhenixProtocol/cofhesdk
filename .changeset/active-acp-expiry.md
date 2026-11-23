---
'@cofhe/react': patch
---

Corrects `useCofheActiveACP` to report `isValid: false` once the active ACP expires while the component stays mounted. Previously it kept returning `true` until the ACP store changed, so ACP-gated reads and decrypts ran with the expired ACP and failed with an expiry error.
