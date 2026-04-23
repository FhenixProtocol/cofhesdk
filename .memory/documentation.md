# Documentation

Tone and purpose conventions for internal and contributor-facing docs in this repo.

---

## Audience split

| Doc type | Audience | Tone |
|---|---|---|
| `.memory/*.md` | Agents + senior contributors | Robotic, dense — see `MEMORY.md` |
| `README.md` in test packages | Mid-level contributors | Precise, direct — senior-to-mid |
| Inline source comments | Any contributor | Only non-obvious intent; no narration |

---

## Contributor README tone

Written as a senior developer addressing a mid-level developer. Rules:

- No verbose intros or padded explanations
- Assume familiarity with the stack (viem, vitest, Foundry, pnpm workspaces)
- State what a thing does, not what it is
- Prefer tables and code blocks over prose
- Explain design decisions only when they are non-obvious or constrain future changes
- Don't define terms any SDK contributor would already know

**Good:** `pnpm test` runs node only locally, node + web in CI (`CI=true`).
**Bad:** This section describes how to run the tests. Depending on your environment, the behavior may differ...

---

## Inline comment rules

- Explain *why*, never *what*
- No comments that restate the code (`// increment counter`)
- Acceptable: constraint notes, trade-off explanations, gotcha warnings
- `NOTE:` prefix for important constraints (e.g. `// NOTE: Must not use process.env in this file`)

---

## `inherited` vs `flexible` distinction (integration-matrix)

This distinction should be reflected wherever the suites are documented:

- `inherited.ts` — stable contract. Every test must pass on every enabled chain before merging. Tests move *into* this file only when the behaviour is finalised.
- `flexible.ts` — unguarded scratch pad for active feature development. Tests move *out* to `inherited.ts` when ready. Never treated as a stability signal.

---

## Constraints

- Do not add `test:node` / `test:web` usage to the root README — the integration-matrix README is the right home for that detail
- `CI` env var must remain in `turbo.json`'s `test` task `passThroughEnv` or the CI/local dispatch in `scripts/test.mjs` will not see it
