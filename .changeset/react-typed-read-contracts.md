---
'@cofhe/react': patch
---

`useCofheReadContracts` now types each entry's result: `contracts` is a const generic checked entry by entry against its own `abi` (viem's `MulticallContracts`, as wagmi's `useReadContracts` uses), and `data[i].result` carries that entry's decoded type — a literal tuple index by index, a `.map`-built list as an array of one item type when its `functionName` stays literal (`'balanceOf' as const`), and an `euint64` output as the encrypted value `{ ctHash, utype }` rather than a bigint. Entries in a looser shape (`abi: Abi`, `functionName: string`) still compile with `unknown` results, so existing callers keep working; a `.result as bigint` on an encrypted output becomes a compile error, which is the point. New exported types: `CofheReadContractsData`, `CofheReadContractsEntryResult`; `CofheReadContractsItem` and `UseCofheReadContractsResult` gained an optional type parameter.
