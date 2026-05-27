# @cofhe/eslint-config

Shareable ESLint presets for CoFHE packages and external TypeScript monorepos.

## Install

Install the preset together with its ESLint peer dependencies in the package that will consume it.

### Base library preset

```sh
pnpm add -D @cofhe/eslint-config eslint @typescript-eslint/parser typescript eslint-config-prettier eslint-config-turbo eslint-import-resolver-typescript eslint-plugin-only-warn
```

### React library preset

```sh
pnpm add -D @cofhe/eslint-config eslint @typescript-eslint/parser typescript eslint-config-prettier eslint-config-turbo eslint-import-resolver-typescript eslint-plugin-only-warn eslint-plugin-react-hooks
```

### Next.js app preset

```sh
pnpm add -D @cofhe/eslint-config eslint @typescript-eslint/parser typescript eslint-config-prettier eslint-config-turbo eslint-import-resolver-typescript eslint-plugin-only-warn @vercel/style-guide @next/eslint-plugin-next
```

If you use npm or yarn instead, translate the same package list directly:

```sh
npm install --save-dev @cofhe/eslint-config eslint @typescript-eslint/parser typescript eslint-config-prettier eslint-config-turbo eslint-import-resolver-typescript eslint-plugin-only-warn
```

```sh
yarn add -D @cofhe/eslint-config eslint @typescript-eslint/parser typescript eslint-config-prettier eslint-config-turbo eslint-import-resolver-typescript eslint-plugin-only-warn
```

## Presets

- `@cofhe/eslint-config` or `@cofhe/eslint-config/library`: base preset for TypeScript libraries and Node packages.
- `@cofhe/eslint-config/react-internal`: React library preset for bundled component packages.
- `@cofhe/eslint-config/next`: Next.js app preset.

## Usage

### TypeScript library

```js
/** @type {import('eslint').Linter.Config} */
module.exports = {
  extends: ['@cofhe/eslint-config'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: true,
  },
};
```

### React component package

```js
/** @type {import('eslint').Linter.Config} */
module.exports = {
  extends: ['@cofhe/eslint-config/react-internal'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: true,
  },
};
```

### Next.js app

```js
/** @type {import('eslint').Linter.Config} */
module.exports = {
  extends: ['@cofhe/eslint-config/next'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: true,
  },
};
```

## Notes

- The presets are currently written for legacy `.eslintrc.*` configuration, matching the rest of this repository.
- The configs point ESLint's TypeScript import resolver at the consuming package's `tsconfig.json` via `process.cwd()`.
