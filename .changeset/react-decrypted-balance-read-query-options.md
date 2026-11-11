---
'@cofhe/react': patch
---

`useCofheTokenDecryptedBalance` takes `readQueryOptions` for the on-chain ciphertext read behind the balance (`refetchInterval`, `staleTime`, `retry` and the other timing options). A `refetchInterval` there polls the balance: a changed handle decrypts on its own, an unchanged one is not decrypted again. The hook's other options keep shaping the decrypt query.
