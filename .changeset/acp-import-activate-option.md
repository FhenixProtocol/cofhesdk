---
'@cofhe/sdk': patch
---

`client.acp.importShared` and `client.acp.importFromChain` take an `activate` option (default `true`). With `activate: false` the imported ACP is stored without becoming the active ACP, so decrypts that use the active ACP are unaffected; use the imported ACP explicitly, e.g. `.withACP(acp)`. `importShared`'s second argument is now `{ activate?, publicClient?, walletClient? }`; passing `{ publicClient, walletClient }` works as before.
