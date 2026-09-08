---
'@cofhe/sdk': patch
---

feat(sdk): expose recommended gas limits and helpers for FHE contract operations

Standard RPC `eth_estimateGas` underestimates precompile execution costs for homomorphic operations on FHE networks (such as Arbitrum Sepolia and Ethereum Sepolia), causing contract write transactions to revert with out-of-gas errors unless explicit gas limits are provided.

This change exposes:
- `FHE_GAS_LIMITS`: Constant gas limits for `COMPUTE` (5,000,000 gas), `PUBLISH_RESULT` (500,000 gas), and `VERIFY_INPUT` (1,000,000 gas).
- `getRecommendedFheGasLimit(operation)`: Utility helper function returning recommended minimum gas limit per operation category.
