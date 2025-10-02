---
'@cofhesdk/permits': minor
'@cofhesdk/chains': minor
'@cofhesdk/core': minor
---

Create /core store which holds the supplied config, viem clients, and platform specific logic.
Platform specific logic allows the /web and /node endpoints to pass tfhe library without core importing tfhe.
Split /core `initialize` function into `create` and `connect`.
Ported `encryptInputs` function from `cofhejs` with improvements.
