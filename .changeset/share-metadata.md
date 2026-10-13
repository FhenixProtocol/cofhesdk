---
'@cofhe/sdk': minor
'@cofhe/react': minor
'@cofhe/mock-contracts': minor
'@cofhe/hardhat-plugin': minor
'@cofhe/hardhat-3-plugin': minor
'@cofhe/foundry-plugin': minor
---

Share labels. A SNAPSHOT share can now say where each shared value came from, and the recipient can check that against the chain. To carry the labels, the on-chain share registry moves to a new layout.

**Breaking:**

- **Registry ABI.** `share(acp, metadata)` stores only a share header (issuer, expiration, recipient, revoker, block). The full ACP and the metadata go in the `Shared` event, where the share id is now an indexed topic. `sharesFor` returns `(shareIds, headers)` and `getShare` returns a header. `ACP_SHARE_REGISTRY_ABI` changes to match. Code that calls the registry directly must follow these changes. Code that goes through `client.acp` needs no change.
- **The ACP name is no longer shared.** `export()` doesn't write `name`, and `SharedACP` has no `name` field. `importShared` ignores a `name` in the JSON. By default the imported ACP is named after its issuer ("Shared by 0x1234…abcd"). To set it, use `importShared(share, { name })` or `importFromChain(share, { name })`. On-chain shares never carried a name.
- **Mocks.** They now need Solidity 0.8.25 or later and `@openzeppelin/contracts-upgradeable`, which is a new peer dependency of the Hardhat plugin. Foundry users add its remapping.

**@cofhe/sdk**

- Each shared handle can have a label that says where its value came from. There are two kinds:
  - a value read from a contract, e.g. `balanceOf(issuer)` on a token at block N;
  - a value emitted in an event, e.g. the amount of a `Transfer` in a given transaction.
- `client.acp.createSharing({ ..., labels })` encodes the labels onto the sharing ACP as `metadata`. Both ways of handing over the share then carry them:

  - `shareOnChain(acp)` posts them;
  - `export()` writes them into the JSON as `SharedACP.metadata` (optional).

  `importShared` and `importFromChain` keep them on the recipient ACP. To post other labels on-chain, use `shareOnChain(acp, { labels })`.

- `client.acp.verifyShareLabels(share, { verify: 'all' | 'events' | 'none' })` checks the labels against the chain. It takes a share from the registry or an imported ACP. `describeShareMetadata(blob, handles, abis)` turns the labels into function and event names with their params.
- `getIncomingShares` reads the headers, then the events, with one single-block `getLogs` per block. `IncomingShare` gains `metadata`. New `client.acp.getShareFromChain(shareId)` reads one share.
- `@cofhe/sdk/acps` also exports:
  - `encodeShareMetadata`, `decodeShareMetadata`;
  - `verifyShareLabel(s)`, `describeShareLabels`;
  - `eventLabelOfLog`, `confidentialBalanceLabel`;
  - `readSharesFor`, `readShare`, `readPostedShares`;
  - the `LabelledShare` type.

**@cofhe/react**

- `useCofheShareLabels(share, { verify, abis })` describes a share's labels right away and fills in each label's check as the chain answers.
- `useCofheShareOnChain` takes `{ acp, labels }` or `{ acp, metadata }` as well as a bare ACP.
- The floating button's inbox shows each share's labels and their checks. Its import form passes the name through `importShared`'s `name` option.

**Mocks and plugins**

- The ACP contracts in the mocks are cofhe-contracts' own. `ACPShareRegistry.sol`, `ACPTimestampRevoker.sol` and `Permissioned.sol` are copied verbatim from a pinned cofhe-contracts commit (`contracts/cofhe-contracts.json`). Build and test fail if a copy is edited, and `pnpm update:cofhe-contracts <commit>` refreshes the copies.
- `MockPermissioned` moves to `MockPermissioned.sol` and now builds on the real `PermissionedUpgradeable`.
- The plugins deploy the share registry behind `MockERC1967Proxy`, as the upgradeable production contract, with the deployer as admin.
