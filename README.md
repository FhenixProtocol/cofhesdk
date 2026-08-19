# CoFHE SDK

This repository contains the tooling for interacting with Fhenix's CoFHE coprocessor.

## Packages

- `@cofhe/sdk` — core SDK for fetching FHE keys, encrypting inputs, decrypting handles, and working with ACPs via subpath modules such as `@cofhe/sdk/adapters`, `@cofhe/sdk/acps`, `@cofhe/sdk/web`, and `@cofhe/sdk/node`.
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

## Migration

`cofheClient.encryptInputs(...).execute()` returns `[...hashes, signature]` — one `external*` handle per input followed by a single signature authenticating the whole batch — replacing the old per-item `CofheInUint8`/`EncryptedUint8Input` structs. `setConsumingContract(address)` is required before `execute()`.

See the [0.7.0 migration guide](https://cofhesdk.fhenix.io/migrating-to-0-7-0), or run the [migration skill](skills/cofhe-migrate-0-6-to-0-7) against your project.

## Versioning and releases

This monorepo uses [Changesets](https://github.com/changesets/changesets) for package versioning and release notes.

Create a changeset for package changes with:

```bash
pnpm changeset
```

Documentation-only changes may not require a package version bump; follow the conventions used by existing pull requests when deciding whether to add a changeset.

## Notes

- FHE keys are fetched only when `client.encryptInputs(...).execute()` is called because they are only needed for input encryption.
- TFHE WASM initialization is also deferred until `client.encryptInputs(...).execute()` is called.
