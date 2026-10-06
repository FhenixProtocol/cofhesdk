---
'@cofhe/sdk': patch
---

The Node in-memory storage fallback (used when the filesystem key cache is not writable) no longer JSON-encodes values a second time. Previously cached FHE keys and CRS read back from the fallback as strings instead of objects, so they were effectively lost and refetched.
