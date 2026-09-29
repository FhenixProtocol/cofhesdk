---
'@cofhe/sdk': patch
---

New `client.acp.checkAccess(acp, handle?)` (and `ACPUtils.checkAccessOnChain`) returns an ACP on-chain status instead of reverting: `valid`, `expired`, `revoked` or an invalid signature, and with a handle `allowed`, `out-of-scope` or `issuer-not-allowed`. New exported type: `ACPAccessStatus`. ACL reverts are now recognized when the public client comes from another copy of viem than the SDK, which also fixes `checkValidityOnChain` throwing a generic error in that setup.
