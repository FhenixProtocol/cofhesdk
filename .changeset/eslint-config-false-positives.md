---
"@cofhe/eslint-config": patch
---

Fixed several false-positive ESLint warnings surfaced in `@cofhe/react`:

- Added `es2021` to `env` in `react-internal.js` so `globalThis` is recognized (it's already used at runtime and targeted by the `tsconfig`, ESLint's `env` just wasn't configured to know about it).
- Set `no-constant-condition`'s `checkLoops` to `false` so intentional `while (true)` polling loops (with internal abort-signal checks) aren't flagged.

Also removed two now-unnecessary `import React from 'react'` statements in test files (the project uses the automatic JSX runtime, so the import was dead code and was also triggering a spurious `no-redeclare` against the config's `React: true` global), and removed one unused `useMemo` dependency.
