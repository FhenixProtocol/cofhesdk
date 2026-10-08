---
'@cofhe/sdk': minor
'@cofhe/react': minor
---

The ACP `name` stays with whoever wrote it. `export()` no longer writes it into the JSON (`SharedACP` has no `name`), and `importShared` ignores a `name` in the share. The imported acp is named after its issuer ("Shared by 0x1234…abcd"), or `importShared(share, { name })` / `importFromChain(share, { name })` names it. On-chain shares never carried it; that is now documented as deliberate. In React, the import form's name goes through that option.
