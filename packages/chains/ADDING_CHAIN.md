To enable cofhesdk to support a new chain:

1. Create a new entry for the chain in `chains/src`
2. Add the new chain to the exports in `chains/src/index.ts`
3. Add the matching viem chain to `permits/src/supportedChains.ts`
