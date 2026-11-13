# Contributing

Thanks for helping with the CoFHE SDK. This page covers what to run before you open a pull request, and what the CI expects.

## Setup

- Node.js 18 or newer, pnpm 8.15.6 (`corepack enable` picks the right version from `package.json`).
- [Foundry](https://getfoundry.sh) (`forge`): the lint and type-check steps build the Solidity mock contracts, so they need it installed.

```bash
pnpm install
pnpm build
```

## Run the checks before you push

Pull requests from forks don't start their CI until a maintainer approves the run, so you may wait a while to see a result. Every check below runs locally in under a minute; run them first and the first CI run is far more likely to be green.

| CI check              | Command                  | Fixes                                |
| --------------------- | ------------------------ | ------------------------------------ |
| Formatting            | `pnpm check:formatting`  | `pnpm format`                        |
| Linting               | `pnpm lint`              | fix what it reports                  |
| Type Check            | `pnpm check:types`       |                                      |
| Dependency Pins       | `pnpm check:pinned-deps` | pin the exact version, no `^` or `~` |
| Circular Dependencies | `pnpm check:circles`     |                                      |

Formatting is the one that fails most often. `pnpm format` rewrites the files; commit the result.

Tests:

```bash
pnpm test
```

This runs the unit tests and the suites against local mocks. The suites that write to a testnet need a funded key and run only in CI, where a maintainer triggers them.

## Changesets

If your change touches a published package (`@cofhe/sdk`, `@cofhe/react`, the plugins, `@cofhe/abi`, `@cofhe/mock-contracts`), add exactly one changeset:

```bash
pnpm changeset
```

Write it for a developer upgrading the package: what changed for them, and whether they have to act. Changes to docs, examples, `@cofhe/site`, tests or the private config packages don't need one. The writing rules, with examples, are in [`.memory/changesets.md`](./.memory/changesets.md).

## Pull requests

- One change per pull request. A fix and an unrelated cleanup are two PRs.
- Say in the description what a user saw before and sees after. Root cause and how you verified it belong there too, not in the changeset.
- Don't extend exports marked `@internal`; they are not a supported API (see the README).
- Keep the commits you want reviewed; a reviewer may ask you to squash before merge.
