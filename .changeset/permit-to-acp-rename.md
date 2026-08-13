---
'@cofhe/sdk': minor
'@cofhe/react': minor
---

**Permit is now ACP everywhere.** All Permit-named API surface is renamed to ACP to avoid confusion with classic DeFi permits: types (`SelfACP`, `SharingACP`, `RecipientACP`, ...), client methods (`getOrCreateSelfACP`, `withACP`, ...), react hooks and components (`useCofheACPs`, `ACPCard`, ...), error codes (`ACP_DENIED`, ...), the `@cofhe/sdk/permits` entrypoint (now `@cofhe/sdk/acps`), and all documentation. English prose words (permitted/permitting) and protocol contract interfaces are unchanged. The persisted store key also changed; previously stored ACPs are not migrated and are transparently re-created on next use.
