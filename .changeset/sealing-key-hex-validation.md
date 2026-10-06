---
'@cofhe/sdk': patch
---

`seal` and `unsealWithPrivateKey` now throw when the sealing key contains non-hex characters. Previously a 64-character key with invalid characters passed the length check and those characters decoded to zero bytes, so `seal` silently encrypted to the wrong key (an entirely invalid key became the all-zero key, which offers no confidentiality), and `unsealWithPrivateKey` failed later with `Failed to decrypt message`.
