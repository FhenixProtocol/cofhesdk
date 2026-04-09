# MEMORY

The `.memory` folder contains internal reference documents for humans and agents working on this SDK. Entries are not user-facing documentation. They exist to transfer persistent context efficiently — across sessions, across contributors, across agent invocations.

---

## When to Create an Entry

Create an entry when:

- A non-obvious system has been set up and its behavior would not be recoverable from code inspection alone
- Decisions were made that constrain future changes (e.g. pinned versions, required config fields)
- A workflow has manual steps or prerequistes that are easy to omit
- An error was encountered and resolved in a way that should not be repeated

Do not create an entry for:

- Things already obvious from reading the code
- General knowledge about external tools (this is not a tutorial folder)
- One-off decisions with no ongoing relevance

---

## Tone

Robotic. Dense. No filler. Write as if every word costs something.

- No introductory sentences ("This document explains...")
- No affirmations ("Great question")
- No padding ("It is important to note that...")
- State facts. State constraints. State consequences.
- Use tables and lists over prose where structure exists
- Assume the reader is already familiar with the codebase

---

## Audience

Primary: agents working on the SDK across sessions who need fast, reliable context.
Secondary: human contributors who know the SDK and want the *why*, not the *what*.

Do not explain basics. Do not define terms that any SDK contributor would already know.

---

## Format

```
# <Title>

One-line description of what this covers. (optional, only if not obvious from title)

---

## <Section>

Content.

---

## Constraints

Bulleted list of hard constraints, gotchas, or non-obvious requirements.
```

Files are Markdown. Filename is lowercase, hyphenated, no prefix. Example: `publishing.md`, `mock-contracts.md`, `test-setup.md`.

---

## Maintenance

Update an entry when the system it describes changes. Stale memory is worse than no memory. If a constraint is resolved or a workflow changes, edit the entry — do not append a note at the bottom.
