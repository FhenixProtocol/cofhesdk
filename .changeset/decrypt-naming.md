---
'@cofhe/sdk': minor
'@cofhe/react': minor
---

Decrypt names say which decrypt they mean. The old names stay as deprecated aliases unless noted.

- `UnsealedItem<U>` is now `DecryptForViewResult<U>`, the pair of `DecryptForTxResult`.
- `useCofheDecrypt` is now `useCofheDecryptForView`, the pair of `useCofheDecryptForTx`.
- Removed, no alias: the client's `decryptHandle`, deprecated in favour of `decryptForView`.
- Changed, no alias: the query `meta.kind` of a view decrypt is `'cofheDecryptForView'` (was `'cofheDecrypt'`). Code that filters queries by that kind has to follow.
- Changed, no alias: the query key of a view decrypt starts with `'decryptForView'` (was `'decryptCiphertext'`). Decrypted values persisted under the old key are not read any more, so each value is decrypted once again after the upgrade.
