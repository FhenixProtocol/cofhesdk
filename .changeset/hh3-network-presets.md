---
'@cofhe/hardhat-3-plugin': patch
---

Corrects the `localcofhe`, `eth-sepolia` and `arb-sepolia` network presets so `network.connect()` and `--network` can open them. Previously every connection to them threw before sending a request (`HHE707: Invalid config override` on Hardhat 3.1.12), so `cofhe:faucet --network localcofhe` could not run either. A `PRIVATE_KEY`, `SEPOLIA_RPC_URL` or `ARBITRUM_SEPOLIA_RPC_URL` value that is not valid no longer fails every Hardhat command at startup; it is reported when a testnet preset is used.
