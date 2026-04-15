---
'@cofhe/react': patch
---

Remove the MUI icon peer dependency requirement from `@cofhe/react` by bundling the package's internal icons.

Consumers can now install `@cofhe/react` without adding `@mui/icons-material` or `@mui/material` just to use the built-in UI components.
