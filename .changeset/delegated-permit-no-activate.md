---
'@cofhe/sdk': patch
---

fix(sdk): don't activate delegated (sharing) permits on creation

`createPermitWithSign` always stored the newly created permit as the issuer's active permit, so creating a delegated/sharing permit hijacked the issuer's own active permit. A delegated permit is for the recipient and must not change the issuer's active permit.

`createSharing` now defaults to store-only; `getOrCreateSharingACP` (which genuinely wants an active sharing ACP) opts in via `activate: true`. Self ACPs are unchanged.
