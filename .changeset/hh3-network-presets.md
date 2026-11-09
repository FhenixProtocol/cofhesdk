---
'@cofhe/hardhat-3-plugin': patch
---

Corrects the `localcofhe`, `eth-sepolia` and `arb-sepolia` network presets so `network.connect()` and `--network` can open them. Previously every connection to them threw before sending a request (`HHE707: Invalid config override` on Hardhat 3.1.12), so `cofhe:faucet --network localcofhe` could not run either.
