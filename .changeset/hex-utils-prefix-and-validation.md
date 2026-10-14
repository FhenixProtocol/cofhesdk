---
'@cofhe/sdk': patch
---

Hex decoding of the FHE public key and CRS now strips `0x` before padding an odd-length string, and throws on non-hex characters instead of silently decoding them to zero bytes.
