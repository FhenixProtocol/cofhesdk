# Browser Dev Compatibility

This note documents the Vite dev-mode compatibility issue that surfaced when
`@cofhe/react` was consumed as raw ESM, why the first fixes looked like an
open-ended pile of consumer shims, and how the issue was fixed in the SDK
package instead.

## What Happened

In the Launch Platform app, `@cofhe/react` was excluded from Vite dependency
optimization so the CoFHE runtime packages could keep their worker and wasm
asset lookups intact. That meant Vite served the React package and its
transitive dependencies directly to the browser instead of pre-bundling the
whole dependency tree through esbuild.

This exposed package-format edges that are normally hidden by a bundler:

- `recharts` imported `es-toolkit/compat/get.js`,
  `es-toolkit/compat/uniqBy.js`, and similar files as if they provided default
  ESM exports.
- Some `es-toolkit/compat/*` files are CommonJS-shaped compatibility modules,
  so the browser reported errors like `does not provide an export named
'default'`.
- After shimming those one by one, the next package edge appeared:
  `use-sync-external-store/shim/with-selector.js` did not expose the named
  export expected by Zustand.
- After bundling more of the dependency graph, the browser then hit
  `Dynamic require of "react" is not supported`, because CommonJS
  `use-sync-external-store` code was still trying to `require("react")` while
  React correctly remained an external peer dependency.

The important signal was that each app-side shim only revealed the next
transitive dependency mismatch. The consumer app was not the right place to own
those details.

## Why Consumer Shims Were The Wrong Fix

The first attempted fixes were Vite aliases or virtual modules in the consumer
app. They were useful for diagnosis, but not as a durable solution:

- They coupled every consumer to internal dependencies of `@cofhe/react`.
- They required consumers to know whether Recharts, Zustand, or another nested
  dependency imported a CommonJS or ESM entrypoint.
- They were fragile across patch releases because a different transitive import
  path could break next.
- They fixed one bundler setup at a time instead of making the published SDK
  browser-safe.

Consumer apps should configure CoFHE runtime concerns such as wasm files,
workers, and iframe storage. They should not need aliases for
`es-toolkit/compat/*`, `use-sync-external-store/*`, Recharts, or Zustand.

## SDK Fix

The fix is in `packages/react/tsup.config.ts`.

First, the React SDK now bundles its implementation dependencies with
`noExternal`. React, React DOM, CoFHE SDK packages, and Viem remain external
peer/runtime dependencies, but UI and state-management implementation details
are bundled into `@cofhe/react`.

This prevents consumers from serving nested dependencies like Recharts,
Zustand, `use-sync-external-store`, and `es-toolkit/compat/*` directly as raw
browser modules.

Second, both selector entrypoints from `use-sync-external-store` are resolved to
an SDK-owned ESM shim:

```ts
build.onResolve({ filter: /^use-sync-external-store\/(?:shim\/)?with-selector(?:\.js)?$/ }, () => ({
  path: useSyncExternalStoreWithSelectorShim,
}));
```

The shim lives at:

```text
packages/react/src/internal/useSyncExternalStoreWithSelector.ts
```

It implements `useSyncExternalStoreWithSelector` using React's native
`useSyncExternalStore` API. That avoids bundling the CommonJS
`use-sync-external-store` selector implementation that dynamically requires the
React peer dependency at runtime.

## What Consumers Still Need

Consumers may still need the CoFHE web Vite helper because the core runtime has
real asset-loading requirements:

- `tfhe` needs the wasm/runtime shim so generated loader paths resolve
  correctly.
- `iframe-shared-storage` needs its browser-compatible entry.
- Worker files and wasm assets still need to be copied and served from stable
  locations.

Those runtime shims are separate from the React SDK dependency-format issue and
should remain in the CoFHE Vite integration.

What consumers should not need anymore:

- aliases for `es-toolkit/compat/*`
- aliases for `use-sync-external-store/*`
- Recharts/Zustand-specific Vite shims
- local app-specific workarounds for `@cofhe/react` transitive dependencies

## Verification

The fix was verified by linking the local SDK into the Launch Platform app,
rebuilding `@cofhe/react`, and running the app in a real Playwright Chromium
session.

The final browser pass rendered the app and reported:

```json
{
  "errors": [],
  "failures": []
}
```

The only remaining warning was an unrelated app configuration fallback for
`VITE_AUCTION_SERVER_URL`.
