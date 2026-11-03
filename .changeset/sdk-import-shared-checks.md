---
'@cofhe/sdk': patch
---

Importing a share (`importShared`, `importFromChain`, `ACPUtils.importSharedAndSign`) now fails before signing when the connected account is not the share's recipient, or when the share has already expired. Such a share can never pass the ACL, and importing it used to replace the active ACP by default.
