# cofhesdk

This repo contains the full toolkit for interacting with Fhenix's CoFHE coprocessor.
The repo is split into the following packages:

- `cofhesdk` Core SDK that fetches FHE keys, encrypts inputs, decrypts handles, and exposes subpath modules such as `cofhesdk/adapters`, `cofhesdk/permits`, `cofhesdk/web`, and `cofhesdk/node`.
- `@cofhesdk/react` React-specific hooks and pre-built components for building CoFHE-enabled frontends.
- `@cofhesdk/mock-contracts` Mock contracts replicating the off-chain CoFHE functionality on-chain for local testing.
- `@cofhesdk/hardhat-plugin` Hardhat plugin that deploys mock contracts and provides utilities for testing CoFHE flows.

# Turborepo Design System starter with Changesets

This is a community-maintained example. If you experience a problem, please submit a pull request with a fix. GitHub Issues will be closed.

## Using this example

Run the following command:

```sh
npx create-turbo@latest -e with-changesets
```

## What's inside?

This Turborepo includes the following:

### Apps and Packages

- `cofhesdk`: Core SDK with adapters, permits, node, and web subpath exports.
- `@cofhesdk/react`: React bindings and components built on top of the core SDK.
- `@cofhesdk/mock-contracts`: Solidity contracts and build pipeline for local CoFHE testing.
- `@cofhesdk/hardhat-plugin`: Hardhat integration that deploys mock contracts and exposes CoFHE utilities.
- `@cofhesdk/hardhat-plugin(tests)`: TODO: next version hardhat plugin?
- `@cofhesdk/eslint-config`: Shared ESLint preset.
- `@cofhesdk/tsconfig`: Shared TypeScript configuration.

Each package and app is 100% [TypeScript](https://www.typescriptlang.org/).

### Utilities

This Turborepo has some additional tools already setup for you:

- [TypeScript](https://www.typescriptlang.org/) for static type checking
- [ESLint](https://eslint.org/) for code linting
- [Prettier](https://prettier.io) for code formatting

### Useful commands

- `yarn build` - Build all packages and the docs site
- `yarn dev` - Develop all packages and the docs site
- `yarn lint` - Lint all packages
- `yarn changeset` - Generate a changeset
- `yarn clean` - Clean up all `node_modules` and `dist` folders (runs each package's clean script)

### Changing the npm organization scope

The npm organization scope for this design system starter is `@cofhesdk`. To change this, it's a bit manual at the moment, but you'll need to do the following:

- Rename folders in `packages/*` to replace `acme` with your desired scope
- Search and replace `acme` with your desired scope
- Re-run `yarn install`

## Versioning and Publishing packages

Package publishing has been configured using [Changesets](https://github.com/changesets/changesets). Please review their [documentation](https://github.com/changesets/changesets#documentation) to familiarize yourself with the workflow.

This example comes with automated npm releases setup in a [GitHub Action](https://github.com/changesets/action). To get this working, you will need to create an `NPM_TOKEN` and `GITHUB_TOKEN` in your repository settings. You should also install the [Changesets bot](https://github.com/apps/changeset-bot) on your GitHub repository as well.

For more information about this automation, refer to the official [changesets documentation](https://github.com/changesets/changesets/blob/main/docs/automating-changesets.md)

### npm

If you want to publish package to the public npm registry and make them publicly available, this is already setup.

To publish packages to a private npm organization scope, **remove** the following from each of the `package.json`'s

```diff
- "publishConfig": {
-  "access": "public"
- },
```

### GitHub Package Registry

See [Working with the npm registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry#publishing-a-package-using-publishconfig-in-the-packagejson-file)

# Migration

Type `CofheInUint8` -> `EncryptedUint8Input`

# Changes

- Fhe keys aren't fetched until `client.encryptInputs(...).encrypt()`, they aren't used anywhere else other than encrypting inputs, so their fetching is deferred until then.
- Initializing the tfhe wasm is also deferred until `client.encryptInputs(...).encrypt()` is called
