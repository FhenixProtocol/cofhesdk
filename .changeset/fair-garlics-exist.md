---
'@cofhe/sdk': patch
---

Fix permit store persistence in Node environments where `localStorage` is missing or only partially implemented by falling back to in-memory storage.