# @cofhe/react

## 1.0.2

### Patch Changes

- 511f34f: **@cofhe/abi**

  Corrects `transformEncryptedReturnTypes` to read the outputs of the overload selected by the call's `args`, now accepted as an optional fourth parameter. Previously it used the first ABI entry with that name, so a plaintext `5n` from an overloaded view could come back as `{ ctHash: 5n, utype: FheTypes.Uint64 }`, or an encrypted result as a raw `bytes32`.

  **@cofhe/react**

  Corrects `useCofheReadContract` to return the result of the overload its `args` select when reading an overloaded view function.

- 6926b07: Scope unshield claim summaries by the active ACP used to decrypt their displayed amounts, bind in-flight fetches to that ACP, and refetch invalidated summaries when an ACP is reselected.
- 1378c87: Corrects `useCofheSimulateWriteContract` to key its cache on every simulation option that affects the result, such as `blockNumber`, `blockTag` and `stateOverride`, and to leave `enabled` out of the key. Previously two simulations that differed only in those options shared one cached result.
- 4119d87: `useCofheAutoConnect` now follows the latest public and wallet clients when they change during an in-flight connection. Previously a rapid account or chain switch could leave CoFHE connected to the old client pair.
- 3d577c8: Corrects `useResolvedCofheToken` and `useTransactionReceiptsByHash` to stay disabled while an explicit `chainId` differs from the connected chain, as `useCofheReadContract` already does. Previously they read through the connected chain's client anyway and cached the result under the requested chain id.
- f003b79: `useCofheTokenDecryptedBalance` now passes its query options (`refetchInterval`, `staleTime`, `retry`, react-query `meta` and the rest) to the decrypt query. They used to be ignored, except `enabled`, and a react-query `meta` replaced the decrypt meta, dropping its label.
- e14eb04: Corrects `FheTypesList` to report the exact `maxValue` for `uint64` and `uint128`. Previously they were computed through a float (`BigInt(2 ** 64 - 1)`), which rounds up to 2^64 and 2^128, so `CofheEncryptInput` accepted a value one above the type's range.
- d3c68bb: `useCofheRevokeACP`, `useCofheShareOnChain` and `useCofheRemoveShare` now reject when the mined transaction reverted. They used to resolve and call `onSuccess`, so the UI reported a revocation, share or removal that never happened on chain.
- 288525d: Corrects `getAllTransactionsByToken` to keep persisted transactions that have no `account` when filtering by account, as `getAllTransactions` already does. Previously such an entry threw a `TypeError` and the whole token history failed to load.
- Updated dependencies [511f34f]
- Updated dependencies [800cdb3]
- Updated dependencies [ddd7026]
- Updated dependencies [bbd9b03]
- Updated dependencies [4418149]
- Updated dependencies [b70a067]
- Updated dependencies [f8c6219]
- Updated dependencies [8fb65ec]
  - @cofhe/abi@1.0.2
  - @cofhe/sdk@1.0.2

## 1.0.1

### Patch Changes

- Updated dependencies [fcc819c]
  - @cofhe/sdk@1.0.1
  - @cofhe/abi@1.0.1

## 1.0.0

### Minor Changes

- 6dcfb7d: ACPs sharing SNAPSHOTs (ctHashes rather than live data) can use the new on-chain ACP Sharing Registry `metadata` field to cite the origin of the snapshotted data (contract address + view-function / event), and the recipient can verify it on-chain. [Docs](https://cofhesdk.fhenix.io/sdk/acp#labelling-a-snapshot-share)

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

### Patch Changes

- 9307bbf: Preserve caller-provided retry policies in `useCofheDecrypt` while retaining the existing three-retry policy as the default.
- df1eb81: **Breaking:** `CofheProvider` takes either `config` or `cofheClient`, not both (passing both throws). With a pre-created client, pass only `cofheClient`; the provider uses the config it was created with.
- dfb81e5: Dual tokens resolved by address (`useResolvedCofheToken`) now use `confidentialDecimals()` for confidential amounts. Previously they used the public `decimals()`, so balances and entered amounts were off by the difference (10^12 for an 18/6 token).
- Updated dependencies [84ccdb7]
- Updated dependencies [b9ea2d4]
- Updated dependencies [d711ce2]
- Updated dependencies [d711ce2]
- Updated dependencies [5a192ee]
- Updated dependencies [757e448]
- Updated dependencies [73d5297]
- Updated dependencies [6dcfb7d]
- Updated dependencies [8fad647]
- Updated dependencies [a4fcea7]
  - @cofhe/abi@1.0.0
  - @cofhe/sdk@1.0.0

## 0.8.0

### Minor Changes

- 17ff23e: Scoped decryption with shared ACPs.

  **@cofhe/sdk**

  - `client.acp.importShared` and `client.acp.importFromChain` take an `activate` option (default `true`). With `activate: false` the imported ACP is stored without becoming the active ACP, so decrypts that use the active ACP are unaffected; use the imported ACP explicitly, e.g. `.withACP(acp)`. `importShared`'s second argument is now `{ activate?, publicClient?, walletClient? }`; passing `{ publicClient, walletClient }` works as before.
  - New `client.acp.checkAccess(acp, handle?)` (and `ACPUtils.checkAccessOnChain`) returns an ACP on-chain status instead of reverting: `valid`, `expired`, `revoked` or an invalid signature, and with a handle `allowed`, `out-of-scope` or `issuer-not-allowed`. New exported type: `ACPAccessStatus`. ACL reverts are now recognized when the public client comes from another copy of viem than the SDK, which also fixes `checkValidityOnChain` throwing a generic error in that setup. ACL reverts reported only as text (`custom error 0x…`, e.g. by a transport that drops the error data) are decoded too. For the issuer copy of a share (type `sharing`, no recipient signature yet) the handle-less check reports expiry and revocation instead of failing on the missing signature.
  - `@cofhe/sdk/acps` exports the on-chain sharing pieces: `ACP_SHARE_REGISTRY_ABI`, `ACP_REVOKER_ABI`, `ACP_SHARE_TUPLE_ABI`, `toChainShare`, `computeShareId`, `shareIdOfChainShare`, `getAclAddress`, `getAclServedAddresses` and `clearAclServedAddresses`, so an app can send registry and revoker writes through its own transaction path and still agree with the registry on share ids.

  **@cofhe/react**

  - Decrypt with a chosen ACP in part of the tree without changing the active ACP. New `<CofheACPScope acp={acp | hash}>` and `useCofheACPScope()`; `useCofheReadContractAndDecrypt`, `useCofheReadContract`, `useCofheReadContracts` and `useCofheTokenDecryptedBalance` take an `acp` option that wins over the scope. Inside a scope `useCofheTokenDecryptedBalance` reads the ACP issuer balance unless given an account, and an invalid or unknown scoped ACP disables the reads (`disabledDueToMissingValidACP`) instead of falling back to the active ACP. The decrypt cache key gains a fifth segment, the hash of the ACP that decrypts (the chosen one, else the active one), so a value decrypted with one ACP never answers for another. New exported types: `CofheACPInput`, `CofheACPScopeValue`.
  - `<CofheACPScope>` and the per-hook `acp` option check the chosen ACP on chain (`client.acp.checkAccess`) when mounted, every minute and on window focus, so a revoked share turns the scope off and drops its decrypted values while the view is open. `useCofheACPScope()` gains `status` (`checking`, `valid`, `expired`, `revoked`, `invalid`, `unverified`); the scope decrypts only while it is `valid`. For a SNAPSHOT (handle-scope) ACP, `useCofheReadContractAndDecrypt` and `useCofheTokenDecryptedBalance` report `isOutOfScope` for a value the share does not list and never send it for decryption. New exported type: `CofheACPStatus`.
  - Plaintext decrypted with a shared (non-self) ACP is kept in memory only: it is no longer written to the persisted query cache. Decrypts are cached under the ACP that made them and dropped when that ACP leaves the ACP store (e.g. `removeACP`) or when a non-self ACP expires while in use, so a revoked or expired share does not keep serving its values from cache.
  - The sharing hooks are exported: `useCofheIncomingShares` (registry inbox, polled; shares already imported by the connected account are left out), `useCofheShareOnChain`, `useCofheImportShared({ activate })` (exported JSON or an `IncomingShare`), `useCofheRemoveShare`, `useCofheRevokeACP` and `useCofheACPStatus` (an ACP on-chain status, re-read after a revoke mines). The write hooks resolve once mined. The package-internal names (`useIncomingShares`, `useShareOnChain`, `useImportFromChain`, `useRemoveShare`) stay as deprecated aliases.
  - New `useCofheACPs({ chainId?, type? })`: the connected account stored ACPs on a chain (the connected chain by default), optionally narrowed to one type, e.g. `useCofheACPs({ type: 'recipient' })` for received shares. `useCofheAllACPs` is deprecated: it returned only the connected account ACPs on the connected chain, not all ACPs, and is now an alias of `useCofheACPs()`.
  - `useCofheDecrypt` is exported: decrypt a ciphertext handle directly (no contract read), with the same `acp` option and scope behaviour as `useCofheReadContractAndDecrypt`.

- 6f7a4c5: Resolve the Task Manager through the `CoFHEAddressBook` (`@fhenixprotocol/cofhe-contracts@1.0.0`). **Breaking:** `TASK_MANAGER_ADDRESS` is removed from `@cofhe/sdk`. Use `getTaskManagerAddress(publicClient)`, which reads `getTm(TASK_MANAGER_ID)` from the book at `COFHE_ADDRESS_BOOK_ADDRESS` (both exported) and caches the result per chain. If the chain has no book, or the id is unset, it throws `TASK_MANAGER_UNRESOLVED`. `verifyDecryptResult`, the ACL/ACP lookups and `useCofheEnabled` / `useCofheReadDecryptionResults` now resolve the Task Manager this way. `@cofhe/react` adds `useCofheTaskManagerAddress()`.

  Mocks: a new `MockCoFHEAddressBook` is deployed at FHE.sol's `COFHE_ADDRESS_BOOK`, and `MockTaskManager` moves to `MOCKS_TASK_MANAGER_ADDRESS` (`0x…5000`) and is registered in the book. `MockACL` now stores its Task Manager (`setTaskManager` / `getTaskManagerAddress`) instead of reading a constant, so its `TASK_MANAGER_ADDRESS_()` getter is gone. All three plugins deploy and wire the book. Hardhat 2 exposes `hre.cofhe.mocks.getMockCoFHEAddressBook()`, Hardhat 3 exposes `conn.cofhe.mocks.MockCoFHEAddressBook`, and Foundry exposes `CofheTest.mockAddressBook`. Contracts must be built against `@fhenixprotocol/cofhe-contracts@1.0.0` or later (the hardhat plugin's peer range is now `>=1.0.0`). Each FHE op now makes one extra `getTm` call on the book, as it does on real networks, so expect slightly higher gas numbers.

- 2732c78: `useCofheReadContracts` (the dynamic-length companion of `useCofheReadContract`) now runs each entry as its own query under the exact `useCofheReadContract` query key, instead of one opaque multicall query. That makes batches first-class citizens of the invalidation design: a `useCofheWriteContract({ invalidates: [{ address, functionName }] })` target refreshes matching batch entries exactly like singular reads, the triggered refetches are block-aware (they wait until the serving RPC node knows the mined block), and cache entries are shared with singular reads of the same call. With a batching transport the entries still coalesce into one JSON-RPC request, and no multicall3 deployment is needed. The hook and its result types are now exported from the package root. The result is a per-entry aggregate (`data[i]` is `{ result }` / `{ error }` / `undefined` while loading) rather than a raw `UseQueryResult`; `multicallOptions` is kept for compatibility but only `allowFailure` is honored, and a new `requiresACP` option gates the whole batch on a valid active ACP like the singular hook.
- 7c1883c: `useCofheWriteContract`'s `invalidates` option now also accepts a function of the mined receipt — `invalidates: (receipt) => targets` — for writes whose targets are only known from the outcome (e.g. an id read out of the event logs). Invalidation still fires once mined, block-aware, for any mined outcome. Invalidation descriptors additionally accept `args` (together with `functionName`) to narrow a target to one exact call — `{ address, functionName: 'getOrder', args: [orderId] }` refreshes just that read, leaving other args of the same function untouched. New exported type: `CofheWriteInvalidates`.
- 273f134: Public token balances and token allowances are ordinary contract reads (`balanceOf(account)`, `allowance(owner, spender)`), and the hooks now ARE ordinary reads: `useTokenAllowance` is a thin wrapper around `useCofheReadContract` (`requiresACP: false`), and `createPublicTokenBalanceQueryOptions` delegates to the generic `createCofheReadContractQueryOptions` for ERC20 balances — same key grammar, same block-aware queryFn, same recognition meta, and the SAME cache entry as a direct read of that call. The bespoke `['tokenBalance', …]` / `['tokenAllowance', …]` key families are gone; a plain `useCofheWriteContract` invalidation descriptor (`{ address: token, functionName: 'balanceOf' | 'allowance' }`, args-narrowable) reaches them with no special vocabulary. The native ETH balance is the one carve-out — `eth_getBalance` is not a contract read — so only its queryFn stays bespoke: it is a documented pseudo-read keyed by the generic key builder at the ETH sentinel address, and `{ address: ETH_SENTINEL, functionName: 'balanceOf' }` targets it like any other read. The `construct…QueryKeyForInvalidation` builders are gone too: their only consumer, the internal pending-transaction tracker, now builds its filters from the same plain descriptors through `normalizeInvalidationTarget` (newly exported from the write hook) — one normalizer behind all invalidation. Existing cached entries under the old keys are simply abandoned to garbage collection.

  Alongside this, the address segment of EVERY `cofheReadContract` key is now canonicalized (best-effort checksummed) inside `constructCofheReadContractQueryForInvalidation`, which both the read-key builders and `useCofheWriteContract`'s invalidation descriptors flow through — so a read key and an invalidation target can never disagree on address case again. Consumers no longer need to pre-checksum addresses on either side.

  `useCofheWriteContract` now invalidates the SENDER's native balance (the ETH-sentinel pseudo-read) implicitly after every mined transaction, success or revert — gas burned it, so that read is stale on any outcome. No call site declares it, and it runs even with no `invalidates` at all; when no native-balance read is mounted it is a true no-op. Recipients of value transfers remain the caller's knowledge, declared like any other target.

  Also removed: the trailing `enabled` segment of the read query key. It was a workaround (a CofheError could leave a disabled query's queryFn running and blank the screen) that no longer applies; keys are now pure data identity, so a read keeps its cache entry across disabled/enabled transitions.

- 7ae7526: `useCofheWriteContract` accepts a new `invalidates` option — read queries to refresh once the write is mined, e.g. `useCofheWriteContract({ invalidates: [{ address, functionName: 'balanceOf' }] })` (`chainId` defaults to the connected chain; omit `functionName` to refresh every read of the contract). Invalidation waits for the transaction receipt and passes the mined block's hash as invalidation context, so the triggered refetches only trust an RPC node that already knows that block. It fires for any mined outcome — a reverted transaction invalidates too, since it still burned gas and advanced the nonce in a real block (reads the revert did not touch refetch to the same value). Raw query keys and full invalidation filters are also accepted.

  Newly exported from the package root: `useCofheReadContract`, `constructCofheReadContractQueryForInvalidation`, and the `UseCofheReadContractResult`, `UseCofheReadContractQueryOptions`, `useCofheWriteContractOptions`, `CofheWriteInvalidationTarget`, `CofheReadInvalidationDescriptor` types.

### Patch Changes

- 594e250: `@tanstack/react-query` is now a peer dependency of `@cofhe/react` (`^5.90.20`)
  instead of a hard dependency pinned to an exact version.

  **Action required for consumers:** declare `@tanstack/react-query` in your own
  dependencies if you do not already. Most apps do, via wagmi — which has always
  declared it as a peer — so in practice nothing changes for them except that the
  duplicate copy disappears.

  Previously every consumer ended up with a _second_ react-query runtime: their own,
  plus the one shipped inside `@cofhe/react`. Two module instances mean two sets of
  React contexts, and anything this package exports that is typed in terms of
  react-query becomes unusable from consumer code, because the type identities
  differ across the two copies — `withInvalidationContext` being the notable case.

  Also raises the floor to `^5.90.20`, which `@tanstack/react-query-persist-client@5.90.22`
  (still a normal dependency here) already required; the previously-pinned `5.90.7`
  never satisfied it. Note react-query has no `5.90.20+` release — the range is first
  satisfiable at `5.91.3`.

- 255885c: Chain-pinned reads: `useCofheReadContract`, `useCofheReadContracts` and `useCofheReadContractAndDecrypt` accept `chainId` — the read's chain, and its cache key's chain segment. On its own it GUARDS the read: it runs only while the wallet is connected to that chain, and otherwise stays disabled with the new `disabledDueToWrongChain` flag — never a silent read of the wrong chain. Pass a `publicClient` with it to serve the read through that client instead, wherever the wallet sits (or with no wallet connected); a client whose own chain disagrees with `chainId` keeps the read disabled. ACP gating and decryption follow the read's chain: `useCofheActiveACP(chainId?)` looks up that chain's ACP (the connected chain by default), and the decrypt step runs against it — and is cached per chain: the decrypt query key now ends with the chain, so the same ciphertext handle decrypted on two chains is two entries (persisted entries of the old key shape are simply orphaned). A write's block-aware invalidation applies only to targets on the chain it was mined on: a descriptor's chain (its `chainId`, else the connected chain), a cofhe key's chain segment, or the new optional `targetChainId` on filters targets. Targets on another chain — or whose chain the hook cannot tell — get a plain refresh, never a watermark for a block their node will not see; a cofhe prefix that spans every chain (no chain segment) is refreshed everywhere and gated on the mined chain's slice only.
- 5353f4a: Remove the `import.meta` reference from the React package runtime so its advertised CommonJS entry can be required by Node.js.
- 255885c: Invalidation contexts become TTL WATERMARKS: block-awareness delivery is deterministic, not ordering luck. Previously a context was consumed by the first fetch that resolved under its prefix — reliable for the concurrent refetches an invalidation triggers, and pure timing luck for anything staggered: a query created after the outcome was known (`getPublish(orderId, newSeq)` after a fill, `getOrder(newId)` after a create), an `enabled` flip, a two-stage ids→batch read. Now `invalidateQueriesWithContext` stores a watermark that gates EVERY fetch under the prefix until it expires (`ttlMs` option, default 60s); entries expire by time, never by being read, and expired entries are pruned lazily (fixing the leak where an undelivered note lived forever). The store's prefix matching now mirrors react-query's partial-matching semantics (deep subset per segment), so an args-narrowed watermark like `args: [orderId]` reaches `getItem(orderId, seq)`-shaped keys exactly like the invalidation itself does. `consumeInvalidationContext` is removed from the public surface (nothing consumes on delivery any more); the once-per-block-probe cost repeats per gated fetch but resolves instantly in the same JSON-RPC batch once the node has caught up.
- a677b3f: `useCofheTokenMetadata` now includes the connected chain id in its query key. Metadata was cached by token address only, so the same address deployed on several chains could show another network's name/symbol/decimals after a chain switch.
- 67bce9c: `useCofheReadContracts` now types its results: each `contracts` entry is checked against its own `abi`, and `data[i].result` is that entry's decoded return type. An `euint64` output is typed as `{ ctHash, utype }`, so a `.result as bigint` cast on it no longer compiles. Entries built with `.map` need a literal `functionName` (`'balanceOf' as const`) to stay typed; looser entries still compile with `unknown` results. New exported types: `CofheReadContractsEntry`, `CofheReadContractsEntries`, `CofheReadContractsEntryResult`, `CofheReadContractsData`.
- 86d7fc9: Both block-aware wait primitives lose their unbounded failure modes. `maybeWaitUntilRpcAware` now distinguishes "the node doesn't know the block yet" (keep polling) from "the read failed on a node that HAS the block" (a real error — revert, missing contract — thrown immediately so react-query's retry/error handling sees it, instead of becoming an invisible 1 req/s poll), and gives up after `maxWaitMs` (default 60s) on a block the node never learns — a reorged-away hash can never become known — degrading to the un-gated read rather than failing it. `resolveReceiptBlockHash` is likewise bounded (throws after `maxWaitMs`), re-fetches the receipt BY TRANSACTION HASH instead of `getBlock({ blockNumber })` (by-height lookup hands back whichever block occupies that height after a reorg — the exact ambiguity hash gating exists to avoid), and takes an options object (`{ signal, maxWaitMs, pollingIntervalMs }`). The write hook's background invalidation deliberately passes no abort signal — invalidation is cache-global work that must survive component unmount — and relies on the bound as its safety.
- Updated dependencies [9dacf73]
- Updated dependencies [7529d66]
- Updated dependencies [17ff23e]
- Updated dependencies [0fe40c3]
- Updated dependencies [6f7a4c5]
- Updated dependencies [552d118]
- Updated dependencies [22eebcc]
- Updated dependencies [42fccae]
  - @cofhe/abi@0.8.0
  - @cofhe/sdk@0.8.0

## 0.7.1

### Patch Changes

- @cofhe/sdk@0.7.1
- @cofhe/abi@0.7.1

## 0.7.0

### Minor Changes

- fb87d91: **Breaking: Permit (V2) → ACP (Access Control Permission).** Permits become scoped, revocable ACPs; old names are removed rather than deprecated. Highlights (full list in the [0.7.0 migration guide](https://cofhesdk.fhenix.io/migrating-to-0-7-0)):

  - `Permit`/`Permission`/`PermitUtils`/`client.permits` → `ACP`/`ACPPublic`/`ACPUtils`/`client.acp`; `getPermission()` → `getPublic()`
  - `ACPPrivate` & `ACPPublic` are top-level types, `ACP` is the union; the sealing keypair is flattened to `sealingPrivateKey`/`sealingKey` (the `SealingKey` class is removed)
  - New scope fields (`scope`, `contracts`, `handles: bytes32[]`) and revocation fields renamed `validatorId`/`validatorContract` → `revokerData`/`revokerContract`; default revoker `ACPTimestampRevoker` with `revokeACP`/`revokeAllACPs`/`isACPRevoked` on the client
  - EIP-712 domain bumped to `("ACL", "2")` with new `ACPIssuerSelf`/`ACPIssuerShared`/`ACPRecipient` types — previously signed permits no longer verify; the permit store migrates by wiping retired-format permits
  - `ACPUtils.export()` produces a fixed `SharedACP` shape and only accepts signed sharing ACPs

- fb87d91: Migrate `cofheClient.encryptInputs` from one-signature-per-ciphertext to the new batch verification scheme (one signature per batch, per `FhenixProtocol/cofhe-contracts#78`).

  **Breaking:** `EncryptInputsBuilder.execute()` now always returns `[...hashes, signature]` (`HashPlusProofResult<T>`) instead of an array of per-item `EncryptedItemInput` structs. `EncryptedItemInput` and its per-type aliases (`EncryptedBoolInput`, `EncryptedUint8Input`, etc.) are removed, along with `EncryptInputsBuilder.asHashPlusProof()` (no longer needed - it's the only shape now). `@cofhe/abi`'s `extractEncryptableValues`/`insertEncryptedValues` now detect `external*` ABI types instead of `struct InEuintXX`, with a new calling convention: any function with encrypted inputs must end with a plain `bytes` parameter to receive the shared batch signature. `@cofhe/foundry-plugin`'s `CofheClient.createIn*` helpers are renamed to `createExternal*` (`createInEuint32` → `createExternalEuint32`, etc.) and now return an `external*` handle plus a batch signature rather than an `InEuintXX` struct; the `createIn*_asHashPlusProof` variants are removed as redundant. See the [0.7.0 migration guide](https://cofhesdk.fhenix.io/migrating-to-0-7-0) for the full list of changes and what contract authors need to update.

- fb87d91: Bind encrypted inputs to a consuming contract (`FhenixProtocol/cofhe-contracts#77`). The verifier-signed digest now includes the contract that will consume the ciphertext, closing a replay path where a signed input packet observed on-chain could be reused against a different contract than the one it was signed for.

  **Breaking:** `EncryptInputsBuilder.setConsumingContract(address)` must be called before `.execute()` - it throws `ConsumingContractUninitialized` otherwise. `@cofhe/mock-contracts`'s `MockTaskManager` signature digest changed to include the consuming contract (external ABI unchanged). `@cofhe/foundry-plugin`'s `CofheClient.createExternal*`/`createEuint32sBatch` helpers now take a required `address consumingContract` as their last parameter (no global setter). `@cofhe/react`'s `useCofheEncryptAndWriteContract` defaults `consumingContract` to the write's target address automatically; `useCofheEncrypt` accepts it as an explicit option. See the [0.7.0 migration guide](https://cofhesdk.fhenix.io/migrating-to-0-7-0) for full details.

- 24edf0c: feat(react): useKnownCofheToken; useCofheToken no longer probes on-chain

  New `useKnownCofheToken({ chainId, address })`: resolves a token address against what the
  client already knows — configured tokenlists, imported (custom) tokens, and the chain's
  default token. Never touches the chain; unknown resolves to `undefined`.

  `useCofheToken` no longer falls back to `useResolvedCofheToken`'s on-chain interface probe
  for unlisted addresses. The silent fallback was incorrect: it also fired for known tokens
  during the tokenlist-loading window and probed the connected chain regardless of the
  requested `chainId`, producing spurious "Address is not a supported CoFHE token" failures
  for stale or wrong-chain addresses. It now delegates to `useKnownCofheToken` (its options
  parameter is deprecated and unused). Consumers that genuinely want on-chain resolution
  must call `useResolvedCofheToken` explicitly.

- fb87d91: **Permit is now ACP everywhere.** All Permit-named API surface is renamed to ACP to avoid confusion with classic DeFi permits: types (`SelfACP`, `SharingACP`, `RecipientACP`, ...), client methods (`getOrCreateSelfACP`, `withACP`, ...), react hooks and components (`useCofheACPs`, `ACPCard`, ...), error codes (`ACP_DENIED`, ...), the `@cofhe/sdk/permits` entrypoint (now `@cofhe/sdk/acps`), and all documentation. English prose words (permitted/permitting) and protocol contract interfaces are unchanged. The persisted store key also changed; previously stored ACPs are not migrated and are transparently re-created on next use.
- fb87d91: Support confidential tokens whose public (underlying) and confidential sides use different decimals (e.g. 18 vs 6): new `getPublicDecimals`/`getConfidentialDecimals`/`getPublicSymbol` accessors and `scaleAmount`/`quantizeAmount` helpers; transaction store entries now record the denomination of their amounts; shield inputs are quantized to the precision the contract actually mints; unshield amounts are guarded against the confidential value type's range.

### Patch Changes

- 2862a63: fix(react): persist only successful query states

  The persistence filter checked only the `meta.persist` opt-in, without react-query's default status check, so a query was dehydrated in whatever state it was in — including `error`. A restored errored query never refetches (persisted queries default to `staleTime: Infinity` / `refetchOnMount: false`), leaving the consumer stuck with a permanent failed state that survives reloads and emits no error event on hydration.

  Only successful states are persisted now. Once a query errors, its entry (including any previously persisted success) is dropped from the snapshot, so the next load starts clean and fetches live.

- Updated dependencies [fb87d91]
- Updated dependencies [fb87d91]
- Updated dependencies [fb87d91]
- Updated dependencies [fb87d91]
- Updated dependencies [fb87d91]
- Updated dependencies [d4d662f]
- Updated dependencies [fb87d91]
- Updated dependencies [fb87d91]
- Updated dependencies [f01cac7]
  - @cofhe/sdk@0.7.0
  - @cofhe/abi@0.7.0

## 0.6.1

### Patch Changes

- Updated dependencies [670cda8]
  - @cofhe/sdk@0.6.1
  - @cofhe/abi@0.6.1

## 0.6.0

### Patch Changes

- bf23270: Upgrade `zustand` to 5.0.13 to pick up the upstream persist storage fix used by the SDK and React package.
- Updated dependencies [bf23270]
- Updated dependencies [2711f9b]
- Updated dependencies [566f126]
  - @cofhe/sdk@0.6.0
  - @cofhe/abi@0.6.0

## 0.5.2

### Patch Changes

- Updated dependencies [2fbb918]
  - @cofhe/sdk@0.5.2
  - @cofhe/abi@0.5.2

## 0.5.1

### Patch Changes

- Updated dependencies [342fd0f]
  - @cofhe/sdk@0.5.1
  - @cofhe/abi@0.5.1

## 0.5.0

### Minor Changes

- 7b1f4c3: Add custom token import support to the React widget token picker.

  - Let users import CoFHE tokens by contract address directly from the token list and portfolio flows.
  - Persist imported tokens per chain in local storage and merge them into `useCofheTokens()` results.
  - Resolve token metadata and CoFHE compatibility on demand before importing, including wrapped-token pair metadata when available.

- 788a6e2: Add `onPoll` callback support for decrypt polling (tx + view) so consumers can observe poll progress.

  - SDK decrypt helpers accept `onPoll` and emit `{ operation, requestId, attemptIndex, elapsedMs, intervalMs, timeoutMs }` once per poll attempt.
  - React wiring supports passing the callback end-to-end.
  - Docs updated with usage examples.

- 9a06012: Tighten permit validation and treat invalid permits as missing.

  - SDK: `PermitUtils.validate` now enforces schema + signed + not-expired (use `PermitUtils.validateSchema` for schema-only validation).
  - SDK: `ValidationResult.error` is now a typed union (`'invalid-schema' | 'expired' | 'not-signed' | null`).
  - React: rename `disabledDueToMissingPermit` to `disabledDueToMissingValidPermit` in read/decrypt hooks and token balance helpers, and disable reads when the active permit is invalid.

- f857263: When no wallet is connected, the portal now hides the wallet header and navigation and shows a message asking the user to connect.

  Add `react.projectName` so apps can include their name in that message.

- 09bf7c9: Add the `useCofheEnabled` hook to read `TaskManager.isEnabled()` from the connected chain.

### Patch Changes

- 503536a: Improve logging ergonomics across React + web SDK.

  - Add a configurable internal logger to `@cofhe/react` via `createCofheConfig({ react: { logger } })`.
  - Make `@cofhe/sdk` `createWebStorage` logging opt-in via `createWebStorage({ enableLog })`.

- 90a0d02: Remove the MUI icon peer dependency requirement from `@cofhe/react` by bundling the package's internal icons.

  Consumers can now install `@cofhe/react` without adding `@mui/icons-material` or `@mui/material` just to use the built-in UI components.

- a685cd4: **Breaking change: upgraded to tfhe v1.5.3.**
  Previous cofhesdk versions will no longer function.
- Updated dependencies [6c4084f]
- Updated dependencies [788a6e2]
- Updated dependencies [9a06012]
- Updated dependencies [503536a]
- Updated dependencies [a685cd4]
  - @cofhe/sdk@0.5.0
  - @cofhe/abi@0.5.0

## 0.4.0

### Patch Changes

- Updated dependencies [e446642]
  - @cofhe/sdk@0.4.0

## 0.3.2

### Patch Changes

- Updated dependencies [d4e86ea]
- Updated dependencies [0feaf3f]
  - @cofhe/sdk@0.3.2

## 0.3.1

### Patch Changes

- 370f0c7: no-op
- Updated dependencies [370f0c7]
  - @cofhe/sdk@0.3.1

## 0.3.0

### Minor Changes

- 35024b6: Remove `sdk` from function names and exported types. Rename:

  - `createCofhesdkConfig` -> `createCofheConfig`
  - `createCofhesdkClient` -> `createCofheClient`
  - `hre.cofhesdk.*` -> `hre.cofhe.*`
  - `hre.cofhesdk.createCofheConfig()` → `hre.cofhe.createConfig()`
  - `hre.cofhesdk.createCofheClient()` → `hre.cofhe.createClient()`
  - `hre.cofhesdk.createBatteriesIncludedCofheClient()` → `hre.cofhe.createClientWithBatteries()`

- 29c2401: implement decrypt-with-proof flows and related tests:

  - Implement production `decryptForTx` backed by Threshold Network `POST /decrypt`, with explicit permit vs global-allowance selection.
  - Rename mocks “Query Decrypter” -> “Threshold Network” and update SDK constants/contracts/artifacts accordingly.
  - Extend mock contracts + hardhat plugin to publish & verify decryption results on-chain, and add end-to-end integration tests.

- 650ea48: Align builder patterns in cofhe client api (`client.encryptInputs(..).encrypt()` and `client.decryptHandles(..).decrypt()`) to use the same terminator function `.execute()` instead of `.encrypt()`/`.decrypt()`.

  Rename `setStepCallback` of encryptInputs builder to `onStep` to improve ergonomics.

### Patch Changes

- Updated dependencies [35024b6]
- Updated dependencies [5467d77]
- Updated dependencies [73b1502]
- Updated dependencies [29c2401]
- Updated dependencies [650ea48]
  - @cofhe/sdk@0.3.0

## 0.2.1

### Patch Changes

- 409bfdf: Add `hash` field to permits, calculated at permit creation time. Replaces `PermitUtils.getHash(permit)` with `permit.hash`.
- Updated dependencies [409bfdf]
- Updated dependencies [ac47e2f]
- Updated dependencies [8af1b70]
  - @cofhe/sdk@0.2.1

## 0.2.0

### Minor Changes

- 8fda09a: Removes `Promise<boolean>` return type from `client.connect(...)`, instead throws an error if the connection fails.
- 4057a76: Add react components and hooks
- e0caeca: Adds `environment: 'node' | 'web' | 'hardhat' | 'react'` option to config. Exposed via `client.config.enviroment`. Automatically populated appropriately within the various `createCofhesdkConfig` functions.

### Patch Changes

- 7f84f1c: Add react package
- Updated dependencies [8fda09a]
- Updated dependencies [4057a76]
- Updated dependencies [dba2759]
- Updated dependencies [e0caeca]
- Updated dependencies [7c861af]
- Updated dependencies [2a9d6c5]
  - @cofhe/sdk@0.2.0

## 0.1.0

### Minor Changes

- a83facb: Prepare for initial release. Rename scope from `@cofhesdk` to `@cofhe` and rename `cofhesdk` package to `@cofhe/sdk`. Create `publish.yml` to publish `beta` packages on merged PR, and `latest` on changeset PR.
