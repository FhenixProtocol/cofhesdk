---
'@cofhe/react': patch
---

`useCofheAutoConnect` now follows the latest public and wallet clients when they change during an in-flight connection. Previously a rapid account or chain switch could leave CoFHE connected to the old client pair.
