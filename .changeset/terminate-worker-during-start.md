---
'@cofhe/sdk': patch
---

Corrects `terminateWorker` to reject a proof request that is still waiting for the worker to start. Previously that request hung for 5 seconds and then failed with a start timeout.
