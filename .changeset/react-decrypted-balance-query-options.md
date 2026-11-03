---
'@cofhe/react': patch
---

`useCofheTokenDecryptedBalance` now passes its query options (`refetchInterval`, `staleTime`, `retry`, react-query `meta` and the rest) to the decrypt query. They used to be ignored, except `enabled`, and a react-query `meta` replaced the decrypt meta, dropping its label.
