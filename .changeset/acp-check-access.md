---
'@cofhe/sdk': patch
---

New `client.acp.checkAccess(acp, handle?)` (and `ACPUtils.checkAccessOnChain`) returns an ACP on-chain status instead of reverting: `valid`, `expired`, `revoked` or an invalid signature, and with a handle `allowed`, `out-of-scope` or `issuer-not-allowed`. New exported type: `ACPAccessStatus`. ACL reverts are now recognized when the public client comes from another copy of viem than the SDK, which also fixes `checkValidityOnChain` throwing a generic error in that setup. ACL reverts reported only as text (`custom error 0x…`, e.g. by a transport that drops the error data) are decoded too. For the issuer copy of a share (type `sharing`, no recipient signature yet) the handle-less check reports expiry and revocation instead of failing on the missing signature.
