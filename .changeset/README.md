# Changesets & Publishing

This directory contains configuration and changeset files for managing versioning and publishing for the `@cofhe/sdk` monorepo.

## Overview

- We use Changesets for versioning and changelogs.
- We publish via a single GitHub Actions workflow at `.github/workflows/publish.yml` using npm Trusted Publishers (OIDC) — no long‑lived tokens.
- Beta “snapshot” releases publish automatically on every merge to `master`.
- Stable releases publish when the Changesets “Version Packages” PR is merged.
- The following packages publish in lockstep (same version) via a Changesets fixed group:
  - `@cofhe/sdk`
  - `@cofhe/mock-contracts`
  - `@cofhe/hardhat-plugin`

## Contributor workflow

1. Create a changeset describing your change:

```bash
pnpm changeset
```

2. Commit the generated file under `.changeset/*.md` with your PR.

3. When your PR is merged to `master`:
   - CI will publish a beta snapshot to npm under the `beta` dist‑tag using a commit‑suffixed prerelease version.
   - Consumers can install betas with `npm i <pkg>@beta`.

## Maintainer workflow

1. Review and merge the auto‑opened Changesets “Version Packages” PR when you’re ready to cut a stable.
2. On merge, CI runs the stable job in `.github/workflows/publish.yml` and publishes to the `latest` dist‑tag.
3. All three packages publish together with the same version due to the fixed group in `.changeset/config.json`.

## Commands

```bash
# Create a new changeset
pnpm changeset

# Apply changesets locally (rarely needed; CI handles versioning)
pnpm version-packages

# Publish stable locally (avoid; CI handles this)
pnpm release

# Beta snapshot locally (for debugging only; CI handles this)
pnpm run beta:snapshot

# Inspect pending changesets
pnpm changeset status
```

## CI details

- Workflow: `.github/workflows/publish.yml`
- Triggers: `push` to `master`
  - Beta job runs when commit message does NOT contain `Version Packages`
  - Stable job runs when commit message DOES contain `Version Packages`
- OIDC permissions are enabled (`id-token: write`, `contents: read`); npm provenance is enabled by default.

## Configuration

- Base branch: `master` (see `.changeset/config.json`)
- Access: `public`
- updateInternalDependencies: `patch`
- fixed: `[["@cofhe/sdk", "@cofhe/mock-contracts", "@cofhe/hardhat-plugin"]]`

## Best practices

- Always include a changeset with user‑visible changes.
- Keep descriptions clear; they become the changelog.
- Merge the “Version Packages” PR only when you’re ready for a stable release.
- For emergency hotfixes, prefer a small changeset + fast Version PR merge rather than local/manual publishes.

## Troubleshooting

- CI didn’t publish beta: ensure the merge commit message doesn’t include `Version Packages` and the workflow ran.
- CI didn’t publish stable: ensure you merged the auto “Version Packages” PR and the workflow ran the stable job.
- Private deps install errors: Trusted Publishers covers publish, not install; use a read‑only token for installs if needed.

## References

- Changesets: https://github.com/changesets/changesets
- npm Trusted Publishers (OIDC): https://docs.npmjs.com/trusted-publishers
