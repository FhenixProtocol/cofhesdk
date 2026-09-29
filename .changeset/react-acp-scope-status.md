---
'@cofhe/react': patch
---

`<CofheACPScope>` and the per-hook `acp` option check the chosen ACP on chain (`client.acp.checkAccess`) when mounted, every minute and on window focus, so a revoked share turns the scope off and drops its decrypted values while the view is open. `useCofheACPScope()` gains `status` (`checking`, `valid`, `expired`, `revoked`, `invalid`, `unverified`); the scope decrypts only while it is `valid`. For a SNAPSHOT (handle-scope) ACP, `useCofheReadContractAndDecrypt` and `useCofheTokenDecryptedBalance` report `isOutOfScope` for a value the share does not list and never send it for decryption. New exported type: `CofheACPStatus`.
