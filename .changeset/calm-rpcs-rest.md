---
'@cofhe/hardhat-3-plugin': patch
---

`network.connect()` now deploys CoFHE mocks automatically only for in-process Hardhat networks and the plugin-injected `localcofhe` endpoint. Previously an arbitrary HTTP RPC could spoof Hardhat methods and trigger signing during connection setup.
