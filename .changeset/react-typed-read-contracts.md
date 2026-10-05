---
'@cofhe/react': patch
---

`useCofheReadContracts` now types its results: each `contracts` entry is checked against its own `abi`, and `data[i].result` is that entry's decoded return type. An `euint64` output is typed as `{ ctHash, utype }`, so a `.result as bigint` cast on it no longer compiles. Entries built with `.map` need a literal `functionName` (`'balanceOf' as const`) to stay typed; looser entries still compile with `unknown` results. New exported types: `CofheReadContractsEntry`, `CofheReadContractsEntries`, `CofheReadContractsEntryResult`, `CofheReadContractsData`.
