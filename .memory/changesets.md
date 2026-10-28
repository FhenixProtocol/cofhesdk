# Changesets

How to write the text of a `.changeset/*.md` file. Mechanics (creating, releasing) are in `.changeset/README.md` and `publishing.md`.

---

## Reader

A developer upgrading `@cofhe/*` who reads the package CHANGELOG to answer two questions: what changed for me, and do I have to act. The text is copied verbatim into the CHANGELOG of every package listed in the frontmatter.

Not the reader: the PR reviewer. Root cause, implementation, test files, lint changes go in the PR body.

---

## Shape

| Change | Shape |
|---|---|
| Fix | `` <Verb> `<exportedName>` to <what it does now>. Previously <symptom a user saw, one concrete value>. `` Two sentences, about 40 words. |
| Feature | `` Adds `<exportedName>` … `` — one sentence on what is possible now, then a short list of the new exports / options. `[Docs](…)` link if a page exists. |
| Breaking | Starts with `**Breaking:**`, then the same verb-first sentence, then what to do instead in one sentence. |
| Several packages | One changeset, a bold heading per package (`**@cofhe/sdk**`, `**@cofhe/react**`), each followed by its own verb-first sentence, so each CHANGELOG reader finds their part. |
| Major release | One extra changeset listing every breaking change since the last major, each pointing to its own entry (see `release-1-0.md` in #408). |

---

## Rules

- Verb first, present tense, then the exported name in backticks: `` Corrects `useResolvedCofheToken` to read … ``. Verbs: `Corrects`, `Adds`, `Removes`, `Renames`, `Changes`, `Deprecates`.
- State the observable symptom of the old behaviour with one concrete value where it helps: `` `Encryptable.uint8(256n)` became `0` ``, `off by 10^12 for an 18/6 token`.
- No `fix(sdk):` / `feat(react):` prefix. The CHANGELOG already groups by bump type.
- Not a copy of the PR title or the PR body.
- Not in the text: file paths, test names, third-party library or function names, "Root cause", how the fix was verified. Those belong in the PR body.
- Bump from the consumer's side: patch = fix, no API change; minor = new export, option or behaviour; major = removal or changed signature.
- Adding members to an exported union type (an action type, an error code) can break a consumer's exhaustive `switch` or `Record<…>` at compile time. Say so in the entry.
- No changeset for private packages (`@cofhe/site`, `@cofhe/eslint-config`, test setup). They are not published.
- No AI-tool trailers, no links to internal tickets or chats.

---

## Examples

Good (fix):

```md
Corrects `useResolvedCofheToken` to read `confidentialDecimals()` for dual tokens. Previously it used the public `decimals()`, so balances and entered amounts were off by the difference (10^12 for an 18/6 token).
```

Good (fix, one line):

```md
Corrects `verifyDecryptResult` to return `false` for signatures that the on-chain `TaskManager` would reject.
```

Good (breaking):

```md
**Breaking:** Changes `CofheProvider` to take either `config` or `cofheClient`, not both (passing both throws). With a pre-created client, pass only `cofheClient`; the provider uses the config it was created with.
```

Too vague, reader cannot tell if it affects them:

```md
Preserve positional tuple shapes when ABI components are unnamed while transforming encrypted inputs and return values.
```

Too internal, belongs in the PR body (the same change as the one-line example above):

```md
`verifyDecryptResult` now returns `false` for signature encodings the TaskManager rejects. It used to return `true` for a valid signature re-encoded with `v` of 0 or 1 or with a high `s` value, while the on-chain `verifyDecryptResult` and `publishDecryptResult` revert with `InvalidSignature` for both (OpenZeppelin `ECDSA.tryRecover`).
```

---

## Constraints

- One changeset per PR. Edit it when the PR changes; do not add a second one.
- The `.changeset/*.md` filename is not shown anywhere; any lowercase hyphenated name works.
- Pending changesets are consumed by the Version Packages PR. Rewording before a stable release happens there or in a consolidation PR (as #408 did for 1.0.0).
