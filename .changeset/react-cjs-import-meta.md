---
'@cofhe/react': patch
---

Remove the `import.meta` reference from the React package runtime so its advertised CommonJS entry can be required by Node.js.
