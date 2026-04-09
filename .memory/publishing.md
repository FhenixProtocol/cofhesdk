# Publishing

**File:** `.github/workflows/publish.yml`
**Tool:** [Changesets](https://github.com/changesets/changesets) + pnpm + GitHub Actions

---

## Trigger Matrix

| Event | Condition | Job(s) fired |
|---|---|---|
| `push` to `master` | commit message ≠ "Version Packages" | `version-packages`, `beta-snapshot` |
| `push` to `master` | commit message = "Version Packages" | `version-packages`, `stable-release` |
| `workflow_dispatch` | any branch | `alpha-snapshot` |

All jobs are mutually exclusive by `event_name` guards. No cross-contamination between manual and automated triggers.

---

## Jobs

### `version-packages`
Runs on every push to master. Uses `changesets/action` to open or update a "Version Packages" PR that bumps package versions and updates changelogs. Does not publish.

### `beta-snapshot`
Runs on push to master when the commit is not a version bump. Calls `pnpm run beta:snapshot`:
```
changeset version --snapshot beta && pnpm -r build && changeset publish --tag beta
```
Produces versions like `0.4.0-beta-<timestamp>`. Published to npm under the `beta` dist-tag. Does not consume changesets permanently.

### `stable-release`
Runs when the "Version Packages" PR is merged (detected by commit message). Calls `pnpm release`:
```
pnpm run build && changeset publish
```
Publishes to npm under `latest`. Creates GitHub releases and tags.

### `alpha-snapshot`
Manual only. Triggered via `workflow_dispatch` from any branch. Calls `pnpm run alpha:snapshot`:
```
changeset version --snapshot alpha && pnpm -r build && changeset publish --tag alpha
```
Produces versions like `0.4.0-alpha-<timestamp>`. Published under the `alpha` dist-tag.

---

## Manual Alpha Trigger

1. Go to **Actions → Publish → Run workflow** in GitHub UI
2. Select the source branch from the dropdown
3. Submit — only `alpha-snapshot` fires

**Prerequisite:** The branch must contain at least one uncommitted changeset file (created via `pnpm changeset`). Without a pending changeset, `changeset version --snapshot` exits without producing versions and nothing is published.

---

## npm dist-tags

| Tag | Install command | Source |
|---|---|---|
| `latest` | `npm install @cofhe/sdk` | stable-release |
| `beta` | `npm install @cofhe/sdk@beta` | beta-snapshot |
| `alpha` | `npm install @cofhe/sdk@alpha` | alpha-snapshot |

---

## Secrets Required

| Secret | Used by |
|---|---|
| `GITHUB_TOKEN` | `version-packages`, `stable-release` (auto-provided) |
| `NPM_TOKEN` | `alpha-snapshot` |
| *(implicit)* | `beta-snapshot` uses `NODE_AUTH_TOKEN` set by `setup-node` |

---

## Constraints

- npm is pinned to `11.6.2` across all jobs. Do not bump without verifying pnpm workspace compatibility.
- `changeset` is not a global binary. Always invoke via `pnpm run <script>` or `pnpm exec changeset`. Calling it directly in shell will produce `command not found`.
- All published packages must have `publishConfig.registry` set to `https://registry.npmjs.org/` in their `package.json`.
