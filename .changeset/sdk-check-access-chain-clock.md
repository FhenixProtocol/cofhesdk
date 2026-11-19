---
'@cofhe/sdk': patch
---

Corrects `client.acp.checkAccess` to check the issuer copy of a share for expiry against the latest block, as the ACL does. Previously it used the local clock, so after a Hardhat `time.increase` past the expiration it still reported `valid`.
