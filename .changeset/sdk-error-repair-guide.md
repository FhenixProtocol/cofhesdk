---
'@cofhe/sdk': minor
'@cofhe/react': patch
---

**@cofhe/sdk**

Adds a repair guide for every `CofheErrorCode`, shipped in the package as `skills/cofhe-errors/SKILL.md`, with the causes and fixes of each code. Each error names its section in the new `CofheError.repairGuide` and at the end of `message`.

- `CofheError.repairGuide`: `node_modules/@cofhe/sdk/skills/cofhe-errors/SKILL.md#acp_not_found`
- `CofheError.shortMessage`: the message without the cause, the hint and the guide
- `isCofheError(error, code)`: also true for a `CofheError` created by a second copy of the SDK in the same app, where `instanceof CofheError` is `false`
- `CofheErrorCode.InvalidArgument` and `CofheErrorCode.InvalidConfig`, which can break an exhaustive `switch` or `Record<CofheErrorCode, …>`

Changes `CofheError.message` to end with the hint and the repair guide (`… | Hint: … | Guide: …`), so a log or test output that prints only the message shows the fix. Use `shortMessage` for text shown to users, and where code compared `message` to an exact string.

Changes invalid arguments and configs to throw a `CofheError` with a `hint`. An invalid config has code `INVALID_CONFIG`; a value that does not fit its type, and a misused decrypt builder (previously `INTERNAL_ERROR`), have code `INVALID_ARGUMENT`.

Corrects `CofheError.serialize()` and `toString()` to leave out viem clients found in `context`, and to not throw on a circular `context`. Previously a `NOT_CONNECTED` error could write the RPC URL of the connected client, API key included, into logs.

**@cofhe/react**

Changes the error text of toasts and the `onError` of `useCofheRemoveACP` and `useCofheSelectACP` to use `CofheError.shortMessage`, so it does not include the developer hint now carried by `message`.
