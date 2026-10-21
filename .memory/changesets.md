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
| Fix | 1–3 sentences: the public name and what it does now, then `Previously …` with the symptom a user saw. |
| Feature | One sentence on what is possible now, then a short list of the new exports / options. No links: name the exports, so readers can search for them wherever the docs live. |
| Breaking | Starts with `**Breaking:**`, then what to do instead in one sentence. |
| Several packages | One changeset, a bold heading per package (`**@cofhe/sdk**`, `**@cofhe/react**`), so each CHANGELOG reader finds their part. |
| Major release | One extra changeset listing every breaking change since the last major, each pointing to its own entry (see `release-1-0.md` in #408). |

---

## Rules

- Subject of the first sentence = the exported name in backticks: `` `useResolvedCofheToken` now reads … ``.
- State the observable symptom of the old behaviour with one concrete value where it helps: `` `Encryptable.uint8(256n)` became `0` ``, `off by 10^12 for an 18/6 token`.
- No conventional-commit line (`fix(sdk): …`) as the first line. The CHANGELOG already groups by bump type.
- Bump from the consumer's side: patch = fix, no API change; minor = new export, option or behaviour; major = removal or changed signature.
- Adding members to an exported union type (an action type, an error code) can break a consumer's exhaustive `switch` or `Record<…>` at compile time. Say so in the entry.
- No changeset for private packages (`@cofhe/site`, `@cofhe/eslint-config`, test setup). They are not published.
- No AI-tool trailers, no links: not to internal tickets or chats, and not to docs pages either (a changelog is permanent, pages move).

---

## Examples

Good (fix):

```md
`useResolvedCofheToken` now reads `confidentialDecimals()` for dual tokens. Previously it used the public `decimals()`, so balances and entered amounts were off by the difference (10^12 for an 18/6 token).
```

Good (breaking):

```md
**Breaking:** `CofheProvider` takes either `config` or `cofheClient`, not both (passing both throws). With a pre-created client, pass only `cofheClient`; the provider uses the config it was created with.
```

Too vague, reader cannot tell if it affects them:

```md
Preserve positional tuple shapes when ABI components are unnamed while transforming encrypted inputs and return values.
```

Too internal, belongs in the PR body:

```md
`mock_checkIsTestnet` decided whether to skip these helpers by checking `bytecode.length === 0` on the result of `provider.getCode(...)`. `getCode` returns `"0x"`, never a zero-length string, …
```

---

## Constraints

- One changeset per PR. Edit it when the PR changes; do not add a second one.
- The `.changeset/*.md` filename is not shown anywhere; any lowercase hyphenated name works.
- Pending changesets are consumed by the Version Packages PR. Rewording before a stable release happens there or in a consolidation PR (as #408 did for 1.0.0).
