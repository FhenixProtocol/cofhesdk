# Agent Guidelines

Project guidelines for coding agents live in `.github/copilot-instructions.md`. Read that file first; this one only repeats the rule most often missed.

## Changesets

- Every PR that changes a published package adds exactly one `.changeset/*.md`. None for private packages (`@cofhe/site`, `@cofhe/eslint-config`).
- The text is copied verbatim into the package CHANGELOG. Write it for a developer upgrading `@cofhe/*`, not for the reviewer.
- Shape of a fix: ``<Verb> `<exportedName>` to <what it does now>. Previously <symptom a user saw, one concrete value>.`` Two sentences, about 40 words. A PR with several user-visible changes gets one such paragraph per change; features, breaking changes and several packages have their own shapes in `.memory/changesets.md`. Verbs: `Corrects`, `Adds`, `Removes`, `Renames`, `Changes`, `Deprecates`.
- No `fix(sdk):` prefix, not a copy of the PR title, no file paths, test names, third-party library names, root cause or verification notes.
- Full rules and examples: `.memory/changesets.md`.
