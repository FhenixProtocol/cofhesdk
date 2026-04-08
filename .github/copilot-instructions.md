# Project Guidelines

## Architecture

- This repository is a pnpm + Turbo monorepo. Use workspace-aware commands from the repo root unless a package README or script clearly requires a package-local command.
- The main package boundaries are:
  - `packages/sdk`: core CoFHE SDK, including encryption, decryption, adapters, permits, chains, and the `@cofhe/sdk/node` and `@cofhe/sdk/web` entrypoints.
  - `packages/react`: React hooks and UI built on top of `@cofhe/sdk`.
  - `packages/mock-contracts`: Solidity mock contracts used for local CoFHE testing.
  - `packages/hardhat-plugin`: Hardhat integration and mock deployment utilities.
  - `packages/hardhat-plugin-test`: integration-style tests that exercise the plugin and SDK together.
  - `packages/site`: Vocs documentation site.
- Mock mode versus production mode is a core architectural split. Before changing encryption, decryption, mock contracts, or Hardhat integration, read `ARCHITECTURE.md` and preserve behavior in both modes.
- Prefer existing public package entrypoints and subpath exports. Do not introduce cross-package imports into private internals when a package already exposes a supported entrypoint.

## Build And Test

- Use `pnpm` in this repo. The workspace is configured around `pnpm` and `turbo`.
- Prefer the smallest relevant command for the area you changed instead of running the whole workspace.
- Common root commands:
  - `pnpm build`
  - `pnpm lint`
  - `pnpm check:types`
  - `pnpm test`
  - `pnpm test:integration`
  - `pnpm check:circles`
- Integration tests are discovered and filtered through `scripts/integration-tests.mjs`. Use that helper when you need to inspect or run a specific integration test case.
- `packages/site` requires Node `>=22`. The rest of the monorepo declares Node `>=18`, so avoid site commands unless the active Node version is compatible.
- `packages/mock-contracts` may rely on Foundry tools such as `forge` for full local builds and contract artifacts.

## Conventions

- Keep changes scoped to the package that owns the behavior. Follow existing script names and config inheritance from `packages/eslint-config` and `packages/tsconfig` instead of introducing package-specific variations without a clear reason.
- Hardhat mock deployment is automatic in many local flows. Account for `COFHE_SKIP_MOCKS_DEPLOY=1` when working on tests or scripts that need manual control over mock deployment.
- Preserve the SDK's public export surface in `packages/sdk/package.json`. Changes to subpath exports or runtime targets usually require corresponding updates across consumers.
- When working in docs or examples, prefer linking to existing package APIs and architecture docs rather than duplicating long explanations in code comments.

## References

- `ARCHITECTURE.md` for mock-versus-production behavior and flow diagrams.
- `README.md` for the package map and top-level development commands.
- `packages/hardhat-plugin/README.md` for mock deployment behavior and Hardhat utilities.
- `packages/site/README.md` for documentation-site specifics.
