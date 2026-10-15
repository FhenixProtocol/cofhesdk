# Publishing

**File:** `.github/workflows/publish.yml`
**Tool:** [Changesets](https://github.com/changesets/changesets) + pnpm + GitHub Actions

---

## Trigger Matrix

| Event | Condition | Job(s) fired |
|---|---|---|
| `push` to `master` | not the bot's Version Packages PR | `version-packages`, `release-gate`, `beta-snapshot` |
| `push` to `master` | merge of the bot's Version Packages PR | `version-packages`, `release-gate`, `stable-release` |
| `workflow_dispatch` | any branch | `named-release` |

All jobs are mutually exclusive by `event_name` guards. No cross-contamination between manual and automated triggers.

---

## Jobs

### `version-packages`
Runs on every push to master. Uses `changesets/action` to open or update a "Version Packages" PR that bumps package versions and updates changelogs. Does not publish.

### `release-gate`
Runs on every push to master. Looks up the PR for the pushed commit (`gh api repos/{repo}/commits/{sha}/pulls`) and outputs `is_release=true` only if it is a merged PR from `changeset-release/master`, in this repo (not a fork), authored by `github-actions[bot]`. The commit message is not used, so naming a PR "Version Packages" does not trigger a stable release. If the gate errors, neither publish job runs.

### `beta-snapshot`
Runs on push to master when `release-gate` says it is not a release. Skips if there are no pending changesets (otherwise the `package.json` versions would publish as-is). Calls `pnpm run beta:snapshot`:
```
changeset version --snapshot beta && pnpm -r build && changeset publish --tag beta
```
Produces versions like `0.4.0-beta-<timestamp>`. Published to npm under the `beta` dist-tag. Does not consume changesets permanently.

### `stable-release`
Runs when `release-gate` confirms the bot's "Version Packages" PR was merged. Calls `pnpm release`:
```
pnpm run build && changeset publish
```
Publishes to npm under `latest`. Creates GitHub releases and tags.

### `named-release`
Manual only. Triggered via `workflow_dispatch` from any branch. Inputs:
- `version` (default blank): explicit semver prerelease, e.g. `1.0.0-beta.0`. Must not already be on npm.
- `dist_tag` (default `alpha`): npm dist-tag. Lowercase, not `latest`.

Blank `version` publishes a `0.0.0-<dist_tag>-<timestamp>` snapshot from pending changesets:
```
changeset version --snapshot <dist_tag> && pnpm -r build && changeset publish --tag <dist_tag>
```
An explicit `version` sets every non-private package to that version as-is, then builds and runs `changeset publish --tag <dist_tag>`. Works on branches with no pending changesets, e.g. `changeset-release/master` to prerelease the upcoming stable.

---

## Manual Named Release

1. Go to **Actions → Publish → Run workflow** in GitHub UI
2. Select the source branch from the dropdown
3. Optionally fill in `version` and `dist_tag`
4. Submit — only `named-release` fires

**Prerequisite (blank version only):** The branch must contain at least one pending changeset file. The job fails early without one, since the snapshot would otherwise be a no-op and publish the real versions.

---

## npm dist-tags

| Tag | Install command | Source |
|---|---|---|
| `latest` | `npm install @cofhe/sdk` | stable-release |
| `beta` | `npm install @cofhe/sdk@beta` | beta-snapshot |
| `alpha` (or custom) | `npm install @cofhe/sdk@alpha` | named-release |

---

## Secrets Required

| Secret | Used by |
|---|---|
| `GITHUB_TOKEN` | `version-packages`, `release-gate`, `stable-release` (auto-provided) |
| `NPM_TOKEN` | `named-release` |
| *(implicit)* | `beta-snapshot` uses `NODE_AUTH_TOKEN` set by `setup-node` |

---

## Constraints

- npm is pinned to `11.6.2` across all jobs. Do not bump without verifying pnpm workspace compatibility.
- `changeset` is not a global binary. Always invoke via `pnpm run <script>` or `pnpm exec changeset`. Calling it directly in shell will produce `command not found`.
- All published packages must have `publishConfig.registry` set to `https://registry.npmjs.org/` in their `package.json`.
