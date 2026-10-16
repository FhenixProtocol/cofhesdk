# Publishing

**File:** `.github/workflows/publish.yml`
**Tool:** [Changesets](https://github.com/changesets/changesets) + pnpm + GitHub Actions

---

## Trigger Matrix

| Event | Condition | Job(s) fired |
|---|---|---|
| `push` to `master` | not the bot's Version Packages PR | `version-packages`, `release-gate`, `canary-snapshot` |
| `push` to `master` | merge of the bot's Version Packages PR | `version-packages`, `release-gate`, `stable-release` |
| `workflow_dispatch` | any branch | `named-release-resolve`, `named-release` |

All jobs are mutually exclusive by `event_name` guards. No cross-contamination between manual and automated triggers. The concurrency group includes the event, so a named release waiting for approval never blocks pushes to master.

---

## Jobs

### `version-packages`
Runs on every push to master. Uses `changesets/action` to open or update a "Version Packages" PR that bumps package versions and updates changelogs. Does not publish.

### `release-gate`
Runs on every push to master. Looks up the PR for the pushed commit (`gh api repos/{repo}/commits/{sha}/pulls`) and outputs `is_release=true` only if it is a merged PR from `changeset-release/master`, in this repo (not a fork), authored by `github-actions[bot]`. The commit message is not used, so naming a PR "Version Packages" does not trigger a stable release. If the gate errors, neither publish job runs.

### `canary-snapshot`
Runs on push to master when `release-gate` says it is not a release. Skips if there are no pending changesets (otherwise the `package.json` versions would publish as-is). Calls `pnpm run canary:snapshot`:
```
changeset version --snapshot canary && pnpm -r build && changeset publish --tag canary
```
Produces versions like `0.0.0-canary-<timestamp>`. Published to npm under the `canary` dist-tag. Does not consume changesets permanently.

### `stable-release`
Runs when `release-gate` confirms the bot's "Version Packages" PR was merged. Calls `pnpm release`:
```
pnpm run build && changeset publish
```
Publishes to npm under `latest`. Creates GitHub releases and tags.

### `named-release-resolve` ("Resolve version")
Manual only, via `workflow_dispatch` from any branch. Works out the exact version and writes `Will publish <version> to @<tag>` to the run summary. Inputs:
- `base_version`: `calculated` (default) or `manual`.
  - `calculated` runs `changeset version` in the job's throwaway checkout and reads `@cofhe/sdk`'s new version, i.e. what the Version Packages PR would release. With no pending changesets (e.g. on `changeset-release/master`) it uses the `package.json` version, and fails if that is already published.
  - `manual` uses `manual_version`, a plain `major.minor.patch` (e.g. `1.2.0`, or `0.0.0` for a throwaway build).
- `dist_tag`: `alpha` (default) or `rc`. Also the prerelease name in the version.
- `prerelease_number`: blank picks the next unused `<base>-<tag>.N` on npm; an entered number fails if already published.

Result: `<base>-<dist_tag>.<N>`, e.g. `1.0.0-rc.0`.

### `named-release` ("Publishing named release - <version>")
Waits for approval on the `named-release` environment (required reviewers, set in repo settings). Then sets every non-private package to the resolved version, builds, and runs `changeset publish --tag <dist_tag>`.

---

## Manual Named Release

1. Go to **Actions → Publish → Run workflow** in GitHub UI
2. Select the source branch from the dropdown; the form comes from that branch's `publish.yml`
3. Pick base version, dist tag and optionally a prerelease number
4. Submit, check the version in the **Resolve version** summary, then **Review deployments → Approve**

---

## npm dist-tags

| Tag | Install command | Source |
|---|---|---|
| `latest` | `npm install @cofhe/sdk` | stable-release |
| `canary` | `npm install @cofhe/sdk@canary` | canary-snapshot |
| `alpha` | `npm install @cofhe/sdk@alpha` | named-release |
| `rc` | `npm install @cofhe/sdk@rc` | named-release |
| `beta` | — | retired; last pointed at the final beta snapshot before the canary rename |

---

## Secrets Required

| Secret | Used by |
|---|---|
| `GITHUB_TOKEN` | `version-packages`, `release-gate`, `stable-release` (auto-provided) |
| `NPM_TOKEN` | `named-release` |
| *(implicit)* | `canary-snapshot` uses `NODE_AUTH_TOKEN` set by `setup-node` |

---

## Constraints

- npm is pinned to `11.6.2` across all jobs. Do not bump without verifying pnpm workspace compatibility.
- `changeset` is not a global binary. Always invoke via `pnpm run <script>` or `pnpm exec changeset`. `pnpm changeset` runs the root `changeset` script (interactive add + format), not the CLI.
- All published packages must have `publishConfig.registry` set to `https://registry.npmjs.org/` in their `package.json`.
