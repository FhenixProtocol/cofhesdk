# @cofhe/tsconfig

Shared TypeScript base configurations for CoFHE packages and external monorepos.

## Install

Install the package alongside TypeScript in the package or workspace that will extend it:

```sh
pnpm add -D typescript @cofhe/tsconfig
```

If you use npm or yarn instead:

```sh
npm install --save-dev typescript @cofhe/tsconfig
```

```sh
yarn add -D typescript @cofhe/tsconfig
```

## Available presets

- `@cofhe/tsconfig/base.json`: strict base config for TypeScript libraries and Node packages.
- `@cofhe/tsconfig/react-library.json`: base config plus React JSX and DOM libs.
- `@cofhe/tsconfig/nextjs.json`: Next.js-oriented config for app packages.
- `@cofhe/tsconfig/node14.json`: legacy CommonJS-oriented preset kept for older runtimes.

## Usage

### TypeScript library

```json
{
  "extends": "@cofhe/tsconfig/base.json",
  "compilerOptions": {
    "outDir": "dist"
  },
  "include": ["src"]
}
```

### React component package

```json
{
  "extends": "@cofhe/tsconfig/react-library.json",
  "compilerOptions": {
    "outDir": "dist"
  },
  "include": ["src"]
}
```

### Next.js app

```json
{
  "extends": "@cofhe/tsconfig/nextjs.json"
}
```

## Notes

- These presets are intentionally small and composable. Override project-specific compiler options in the consuming package.
- Publishing this package alongside `@cofhe/eslint-config` is recommended when another monorepo wants to standardize both lint and TypeScript settings from the same source.
