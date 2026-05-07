# CI Secrets Gating

How `TEST_PRIVATE_KEY` (and any future test secret) is exposed to PRs from forks without weakening security.

---

## Problem

GitHub redacts repository and organization secrets for workflows triggered by `pull_request` from forks. Tests in `test.yml` require a funded `TEST_PRIVATE_KEY`; without gating, fork PRs fail at the validate step.

---

## Architecture

Two workflows + one GitHub Environment.

| Component | File / Location | Role |
|---|---|---|
| Test workflow | `.github/workflows/test.yml` | Runs full test matrix. Conditionally enters the `ci-secrets` environment. |
| Notice workflow | `.github/workflows/pr-fork-notice.yml` | Posts one-time comment on fork PRs explaining the approval flow. |
| Environment | GitHub UI → Settings → Environments → `ci-secrets` | Holds env-scoped copies of test secrets. Gated by required reviewers. |

---

## Routing

`test.yml` uses a conditional `environment` expression:

```yaml
environment: ${{ (github.event_name == 'pull_request' && github.event.pull_request.head.repo.fork) && 'ci-secrets' || '' }}
```

| Trigger | `environment` resolved to | Approval needed | Secret source |
|---|---|---|---|
| Push to `master` / `staging` | `''` (none) | No | Repo-level secret |
| PR from same-repo branch | `''` (none) | No | Repo-level secret |
| PR from fork | `'ci-secrets'` | Yes | `ci-secrets` env secret |

Trusted runs are deliberately not gated. The cost: `TEST_PRIVATE_KEY` must be configured **twice** — once at repo level (for trusted runs), once inside the `ci-secrets` environment (for fork PRs). Same value in both.

---

## Notice Workflow Security Model

`pr-fork-notice.yml` runs on `pull_request_target`, which executes in the base-repo context with a write-capable `GITHUB_TOKEN` even for fork PRs. This is the only safe way to comment on a fork PR.

Hard constraints, in the file's header comment and enforced by review:

- **No `actions/checkout`.** Never check out the PR's ref.
- **No installation of PR-supplied dependencies.** No `pnpm i`, `npm i`, etc.
- **No execution of PR code or scripts.** `actions/github-script` only, against the GitHub REST API.

Violating any of these turns the workflow into a "pwn request" vector — fork code would run with secrets in base context.

---

## One-Time Comment

The notice uses an HTML-comment marker `<!-- cofhe-fork-pr-notice -->` and pages all existing PR comments before posting. Reopens, force-pushes, and re-runs do not produce duplicate notices. Trigger is `[opened, reopened]`.

---

## Reviewer Approval Semantics

- Approval is per workflow run, not per PR. Every push to a fork branch creates a new pending run that requires fresh approval.
- Approver is a required reviewer listed on the `ci-secrets` environment in the GitHub UI.
- After approval, env secrets are injected for the duration of that run only.
- **Read the diff before approving.** Approval releases secrets to whatever code is in the PR head — there is no further sandbox.

---

## Failure Modes

| Symptom | Cause | Fix |
|---|---|---|
| `TEST_PRIVATE_KEY is not available` on fork PR after approval | Secret not added to `ci-secrets` env | Add `TEST_PRIVATE_KEY` under Settings → Environments → ci-secrets → Environment secrets |
| `TEST_PRIVATE_KEY is not available` on internal push | Repo-level secret missing or renamed | Restore Settings → Secrets and variables → Actions → `TEST_PRIVATE_KEY` |
| Fork PR runs without prompting for approval | Required reviewers not configured on env | Settings → Environments → ci-secrets → Deployment protection rules → Required reviewers |
| Internal runs blocked by approval prompt | Conditional expression broken or evaluated truthy on non-fork events | Inspect `environment:` line; `''` should resolve for non-fork triggers |
| Notice comment never appears | Repo has `pull_request_target` events disabled, or workflow file invalid | Check Actions tab for run; verify `Fork PR Notice` workflow exists |

---

## Constraints

- `ci-secrets` environment name is referenced in two places: `test.yml` (`environment:` expression) and `pr-fork-notice.yml` (comment body). Renaming requires updating both.
- The repo-level `TEST_PRIVATE_KEY` secret cannot be deleted while internal trusted runs are expected to skip the gate. Keeping it is the trade-off for zero-friction maintainer pushes.
- Adding a new test secret requires three actions: add to repo-level secrets, add to `ci-secrets` environment, reference via `${{ secrets.<NAME> }}` in `test.yml`.
- The notice workflow must never gain a `actions/checkout` step or any step that runs PR-supplied code. Treat the file as security-sensitive on review.
- `concurrency` group on the notice workflow uses `cancel-in-progress: false` to ensure marker checks complete before duplicate triggers can race.
