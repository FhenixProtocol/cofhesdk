---
"@cofhe/react": patch
---

Fixed a missing `FloatingButtonPage` import in `SendPage.tsx`. The file referenced `FloatingButtonPage.Send` inside its `declare module` type-augmentation block without importing `FloatingButtonPage`, unlike the identical pattern in `PortfolioPage.tsx`. This passed `tsc` (a type-only ambient context) but failed ESLint's `no-undef` rule.
