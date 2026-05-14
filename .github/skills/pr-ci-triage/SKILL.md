---
name: pr-ci-triage
description: 'Triage failed pull request CI checks in this repository. Use when a pushed branch or PR has failing GitHub Actions, formatting, lint, typecheck, test, or Vercel deployment checks and you need the root cause, the failing job logs, and the smallest local reproduction command.'
argument-hint: 'PR number, branch name, or failing check name'
user-invocable: true
---

# PR CI Triage

Use this skill when a pull request or recently pushed branch has failing CI and the goal is to identify the exact failing job, extract the actionable error, reproduce it locally with the smallest repo command, and separate real blockers from ancillary deploy noise.

This repo is a pnpm + Turbo monorepo. Stay at the repo root unless a package explicitly requires a package-local command.

## What To Check First

1. Confirm the local branch before assuming which PR is relevant.
2. Find the PR for that branch instead of assuming the checked-out branch matches the branch in attachments or chat context.
3. Read the PR status checks and identify the failing check names, states, and target URLs.
4. Prefer the failing job log over broad speculation.
5. Reproduce the smallest failing command locally.

## Procedure

1. Identify the current branch and repo remote.
   Use non-interactive git commands from the repo root to confirm the branch actually pushed.

2. Find the PR that matches the head branch.
   Prefer GitHub PR workspace tooling. If the active PR tools do not resolve, search for an open PR by head branch in `FhenixProtocol/cofhesdk`.

3. Pull the status checks for the PR.
   Focus on failed checks first. Capture:

   - check context or name
   - failure state
   - target URL
   - embedded logs when available

4. Read the failure log for the first actionable check.
   In this repo, the most useful signals usually come from these commands:

   - `pnpm check:formatting`
   - `pnpm lint`
   - `pnpm check:types`
   - `pnpm test:integration`

5. Reproduce locally with the narrowest command possible.
   Examples:

   - Formatting failure on one file: `pnpm prettier --check path/to/file.ts`
   - Package lint failure: `pnpm --filter ./packages/react lint`
   - Package typecheck failure: `pnpm --filter ./packages/react check:types`
   - Specific integration case: use `scripts/integration-tests.mjs` helpers before running the full suite.

6. Separate primary CI failures from external deployment failures.
   Vercel checks may fail independently of GitHub Actions. If the Vercel page is not readable without auth, report that the deployment logs require `npx vercel inspect <deployment-id> --logs` instead of guessing.

## Repo-Specific Notes

- The root formatting command is `pnpm check:formatting`, which runs `prettier --check "**/*.{ts,tsx,md}"`.
- The root lint command is `pnpm lint`.
- The root typecheck command is `pnpm check:types`.
- Integration tests are filtered through `scripts/integration-tests.mjs`.
- `packages/site` requires Node `>=22`, but many CI jobs run on Node 20 for the rest of the monorepo. Treat site-specific engine warnings carefully and only escalate them when they are the actual failing condition.

## Reporting Format

When you report back, keep it compact and concrete:

1. Name the failing check or checks.
2. Quote the exact actionable error line.
3. State the minimal local reproduction command.
4. Call out any secondary failures that still need external access, such as Vercel logs.

## Example Outcome

- `Formatting` failed in GitHub Actions.
- Actionable error: `packages/react/src/components/CofheFloatingButton/components/Button.css.ts` failed Prettier.
- Local reproduction: `pnpm prettier --check packages/react/src/components/CofheFloatingButton/components/Button.css.ts`.
- Separate issue: Vercel preview failed, but logs require authenticated Vercel access.
