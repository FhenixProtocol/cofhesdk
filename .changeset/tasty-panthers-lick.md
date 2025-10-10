---
'@cofhesdk/core': minor
'@cofhesdk/node': minor
'@cofhesdk/web': minor
---

Move storage handling from /core to /web (indexdb storage) and /node (filesystem storage with memory fallback). fheKeysStorage has been added to the cofhesdk config, and it is auto-populated in each environment.
