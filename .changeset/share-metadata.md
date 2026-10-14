---
'@cofhe/sdk': minor
'@cofhe/react': minor
'@cofhe/mock-contracts': minor
'@cofhe/hardhat-plugin': minor
'@cofhe/hardhat-3-plugin': minor
'@cofhe/foundry-plugin': minor
---

ACPs sharing SNAPSHOTs (ctHashes rather than live data) can use the new on-chain ACP Sharing Registry `metadata` field to cite the origin of the snapshotted data (contract address + view-function / event), and the recipient can verify it on-chain. [Docs](https://cofhesdk.fhenix.io/sdk/acp#labelling-a-snapshot-share)

**@cofhe/sdk**

- `createSharing({ labels })`, `shareOnChain(acp, { labels | metadata })`; labels travel in `export()` / `importShared` as `SharedACP.metadata`.
- New `client.acp.verifyShareLabels`, `client.acp.getShareFromChain`, and `describeShareMetadata`. `IncomingShare` gains `metadata` and `appKey`.
- New `acp.app` config option: shares are tagged with the app's key and `getIncomingShares` lists only that app's shares ([docs](https://cofhesdk.fhenix.io/sdk/acp#mark-shares-for-your-app)).
- `@cofhe/sdk/acps` exports the metadata codec, label builders (`viewFunctionLabel`, `eventLogLabel`, `UNLABELLED`), verifiers, registry readers, `shareAppKey` and `ERC7984_ABI`.

**@cofhe/react**

- New `useCofheShareLabels`. `useCofheShareOnChain` accepts `{ acp, labels | metadata }`.
- The inbox shows each share's labels and their verification. [Docs](https://cofhesdk.fhenix.io/react/acp#share-labels)

**Mocks and plugins**

- `ACPShareRegistry`, `ACPTimestampRevoker` and `Permissioned` are copied verbatim from a pinned cofhe-contracts commit (`pnpm update:cofhe-contracts <commit>`). The share registry is deployed behind `MockERC1967Proxy`.
- Mocks now need Solidity ≥0.8.25 and `@openzeppelin/contracts-upgradeable` (new Hardhat plugin peer dependency; Foundry users add its remapping).
