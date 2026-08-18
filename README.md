# CoFHE SDK

This repository contains the tooling for interacting with Fhenix's CoFHE coprocessor.

## Packages

- `@cofhe/sdk` — core SDK for fetching FHE keys, encrypting inputs, decrypting handles, and working with permits.
- `@cofhe/react` — React hooks and components for CoFHE-enabled frontends.
- `@cofhe/abi` — shared contract ABIs.
- `@cofhe/mock-contracts` — local mock contracts for testing CoFHE flows.
- `@cofhe/hardhat-plugin` — Hardhat 2 integration for deploying and using the mock stack.
- `@cofhe/hardhat-3-plugin` — Hardhat 3 integration.
- `@cofhe/foundry-plugin` — Foundry helpers for CoFHE contract tests.
- `@cofhe/site` — documentation site.

The repository also contains shared TypeScript and ESLint configuration packages under `packages/`.

## Requirements

- Node.js 18 or newer
- pnpm 8.15.6

## Development

Install dependencies:

```bash
pnpm install
```

Build the packages:

```bash
pnpm build
```

Run the test suite:

```bash
pnpm test
```

Useful repository-wide commands:

```bash
pnpm lint
pnpm check:types
pnpm check:formatting
pnpm format
```

## Documentation

Run the documentation site locally with:

```bash
pnpm docs
```

The main Fhenix developer documentation is available at [docs.fhenix.zone](https://docs.fhenix.zone/).

## Examples

Example applications live in [`examples/`](./examples). See [`examples/README.md`](./examples/README.md) for the current example setup and usage instructions.

## Versioning and releases

This monorepo uses [Changesets](https://github.com/changesets/changesets) for package versioning and release notes.

Create a changeset for package changes with:

```bash
pnpm changeset
```

Documentation-only changes may not require a package version bump; follow the conventions used by existing pull requests when deciding whether to add a changeset.
