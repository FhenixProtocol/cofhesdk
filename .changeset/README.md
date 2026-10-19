# Changesets & Publishing

This directory contains configuration and changeset files for managing versioning and publishing for the `@cofhe/sdk` monorepo.

## Overview

- We use Changesets for versioning and changelogs.
- We publish via a single GitHub Actions workflow at `.github/workflows/publish.yml` using npm Trusted Publishers (OIDC) — no long‑lived tokens.
- Canary “snapshot” releases publish automatically on every merge to `master`.
- Named prereleases (`alpha`, `rc`) publish manually from any branch, after approval.
- Stable releases publish when the Changesets “Version Packages” PR is merged.
- The following packages publish in lockstep (same version) via a Changesets fixed group:
  - `@cofhe/sdk`
  - `@cofhe/mock-contracts`
  - `@cofhe/hardhat-plugin`
  - `@cofhe/react`
  - `@cofhe/example-react`
  - `@cofhe/abi`
  - `@cofhe/site`

## Contributor workflow

1. Create a changeset describing your change:

```bash
pnpm changeset
```

2. Commit the generated file under `.changeset/*.md` with your PR.

3. When your PR is merged to `master`:
   - CI will publish a canary snapshot to npm under the `canary` dist‑tag using a timestamp‑suffixed prerelease version.
   - Consumers can install canaries with `npm i <pkg>@canary`.

## Maintainer workflow

1. Review and merge the auto‑opened Changesets "Version Packages" PR when you're ready to cut a stable.
2. On merge, CI runs the stable job in `.github/workflows/publish.yml` and publishes to the `latest` dist‑tag.
3. All packages in the fixed group publish together with the same version due to the fixed group in `.changeset/config.json`.

## Commands

```bash
# Create a new changeset
pnpm changeset

# Apply changesets locally (rarely needed; CI handles versioning)
pnpm version-packages

# Publish stable locally (avoid; CI handles this)
pnpm release

# Canary snapshot locally (for debugging only; CI handles this)
pnpm run canary:snapshot

# Inspect pending changesets
pnpm changeset status
```

## CI details

- Workflow: `.github/workflows/publish.yml`
- Triggers: `push` to `master`
  - A `release-gate` job checks whether the push is the merge of the changesets bot's PR (`changeset-release/master`, authored by `github-actions[bot]`, same repo). The commit message is not used.
  - Stable job runs when it is; canary job runs otherwise (and skips if there are no pending changesets)
- Trigger: `workflow_dispatch` from any branch runs the `named-release` job (see `.memory/publishing.md`)
  - Docs deployment runs after stable releases to GitHub Pages
- OIDC permissions are enabled (`id-token: write`, `contents: read`); npm provenance is enabled by default.

## Configuration

- Base branch: `master` (see `.changeset/config.json`)
- Access: `public`
- updateInternalDependencies: `patch`
- fixed: `[["@cofhe/sdk", "@cofhe/mock-contracts", "@cofhe/hardhat-plugin", "@cofhe/react", "@cofhe/example-react", "@cofhe/abi"]]`

## Best practices

- Always include a changeset with user‑visible changes.
- Keep descriptions clear; they become the changelog. How to word them: `.memory/changesets.md`.
- Merge the “Version Packages” PR only when you’re ready for a stable release.
- For emergency hotfixes, prefer a small changeset + fast Version PR merge rather than local/manual publishes.

## Troubleshooting

- CI didn't publish canary: ensure the merged PR had a changeset and the workflow ran.
- CI didn't publish stable: ensure you merged the bot's "Version Packages" PR (not a copy) and check the `release-gate` output.
- Docs didn't deploy:
  - Ensure GitHub Pages is configured to use "GitHub Actions" as the source in repository settings
  - Check that the workflow has completed successfully
  - Verify `pages: write` permission is set in the workflow
  - For custom domains, configure them through repository settings (Settings → Pages → Custom domain), not via CNAME file
- Private deps install errors: Trusted Publishers covers publish, not install; use a read‑only token for installs if needed.

## References

- Changesets: https://github.com/changesets/changesets
- npm Trusted Publishers (OIDC): https://docs.npmjs.com/trusted-publishers
