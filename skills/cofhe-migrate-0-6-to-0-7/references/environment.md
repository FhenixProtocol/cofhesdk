# Dependencies, chain, and mock deployments

Do this first. If the chain can't serve ACPs, nothing downstream matters.

## Dependency bump

```jsonc
{
  "@cofhe/sdk": "^0.7.1",
  "@cofhe/react": "^0.7.1",
  "@cofhe/abi": "^0.7.1",
  "@cofhe/hardhat-plugin": "^0.7.1", // or @cofhe/hardhat-3-plugin
  "@cofhe/foundry-plugin": "^0.7.1",
  "@cofhe/mock-contracts": "^0.7.1",
  "@fhenixprotocol/cofhe-contracts": "0.2.0",
  "fhenix-confidential-contracts": "0.4.0", // only if the project uses FHERC20 / confidential tokens
}
```

Every `@cofhe/*` package must be on the same version. Mixed versions produce type errors that
look like migration bugs but aren't.

The last two lines are part of this migration, not optional follow-up work — see
[confidential-tokens.md](confidential-tokens.md) for what 0.4.0 changes. Note the contract
packages are pinned **exactly**, not carets: `FHE.sol` is compiled into the project, so a range
means the ABI can move under a lockfile refresh.

> **In a monorepo, align every workspace manifest — including ones you are not migrating.** A
> workspace whose code you leave alone but which is **bundled into** an app you are migrating
> resolves its own copy of `@cofhe/react`. Two copies in one bundle means two provider contexts,
> and hooks read a store nothing writes. There is no compile error and no install warning; the app
> just behaves as though no provider is mounted.

> **Resolve the versions before quoting them.** Run `npm view @cofhe/sdk dist-tags`,
> `npm view @fhenixprotocol/cofhe-contracts dist-tags` and
> `npm view fhenix-confidential-contracts dist-tags`. If `@cofhe/*` `0.7.1` has not published yet,
> `0.7.0` is the ACP release and the code migration is identical — the difference between them is
> the two contract dependencies below. Do not fall back to `alpha`/`beta` tags now that the stable
> line exists; those are timestamped snapshots and mixing timestamps across packages is its own
> failure mode.

### `@fhenixprotocol/cofhe-contracts` 0.2.0-beta.3 → 0.2.0

`0.2.0` is out, and it is what `fhenix-confidential-contracts@0.4.0` depends on **exactly**. Bump
the pin even in a project that is otherwise already on `@cofhe/*` 0.7.0.

Nothing consumer-facing is removed between the beta and the stable — the delta is additive plus one
mutability relaxation:

- `isAllowed` becomes `view` (on `ICofhe.ITaskManager` and every `FHE.isAllowed` overload). Callers
  are unaffected; a contract that **implements or overrides** `isAllowed` without `view` no longer
  matches the interface and must gain the keyword.
- new operations: `FHE.div` / `FHE.rem` on `euint64`, and `FHE.mul` / `FHE.div` / `FHE.rem` /
  `FHE.square` on `euint128`.

`0.2.0` remains the floor for the `sharedEuintXX` types, which every cross-contract encrypted value
has to move onto — see [shared-euints.md](shared-euints.md).

> **Two copies of `FHE.sol` is the failure to watch for.** If the project pins `0.2.0-beta.3` and
> also pulls `fhenix-confidential-contracts@0.4.0` (which requires `0.2.0`), both resolve. The
> Solidity then has two distinct `sharedEuint64` types with the same name, and the errors read as
> nonsense — a value "is not" the type it obviously is. Check the installed tree, not just the
> manifest: `npm ls @fhenixprotocol/cofhe-contracts` (or `pnpm why`) must report one version.

Install, then let the compiler drive the rest.

## The chain must be ACP-era

The SDK signs ACPs exclusively (EIP-712 domain `("ACL", "2")`). It probes the ACL's
`eip712Domain()` and refuses to create an ACP if the version isn't `"2"`, rather than producing a
signature the chain cannot verify.

If ACP creation fails with an `INVALID_ACP_DOMAIN`-style error, the chain is still serving the
pre-upgrade V2 `Permission` protocol. **There is no workaround** — that deployment must be
upgraded first. Say so plainly instead of trying to work around it.

## Existing signed permits stop verifying

Typehashes and the domain version changed, so every previously signed permit is invalid. The
store (bumped to version 3, under a new key) drops them on load and they are recreated on next
use. Users will see a signature prompt. Nothing to migrate — just don't let it be mistaken for
data loss.

## A half-finished install looks like a bad bump

If the contracts stop compiling right after the dependency change — `FHE.sol` unresolvable, or
`Cannot find module 'hardhat/internal/cli/bootstrap.js'` — suspect the install before the Solidity.
An interrupted `pnpm install` leaves dangling symlinks for `@fhenixprotocol/cofhe-contracts` and
`hardhat` that read exactly like a broken release.

Re-run the install to completion (`CI=true pnpm install`, or the project's equivalent) and re-check
before debugging anything downstream.

## Custom mock deployment scripts

If the project deploys the mock stack itself rather than using the hardhat plugin's deploy step,
two new contracts must be deployed **and wired into the ACL**:

```ts
const revoker = await deploy('ACPTimestampRevoker');
await acl.setDefaultRevokerContract(await revoker.getAddress());

const shareRegistry = await deploy('ACPShareRegistry');
await acl.setShareRegistry(await shareRegistry.getAddress());
```

Both are exported from `@cofhe/mock-contracts` (`ACPTimestampRevokerArtifact`,
`ACPShareRegistryArtifact`). Skipping them leaves revocation and on-chain sharing broken in ways
that surface much later — `client.acp.shareOnChain` / `getIncomingShares` / `importFromChain`
throw `MissingConfig` when neither the ACL nor `config.acp.sharingRegistry` names a registry.

Projects using `@cofhe/hardhat-plugin` or `@cofhe/hardhat-3-plugin`'s built-in deployment get this
automatically.

## Mock transient allowances are now per-transaction

`MockACL` no longer approximates transient storage with `block.number`. If the project has its own
mock-based tests that grant a transient allowance in one transaction and use it in a later one,
they break — see [shared-euints.md](shared-euints.md).

## Retargeting staging is a project, not a flag

`ZK_VERIFY_FAILED` on the public testnets is expected, and the advice is to confirm against
staging — but for anything token-driven that is not a config change. It needs three things:

1. **`stagingCofhe`**, a new exported chain in `@cofhe/sdk/chains` (id `420105`). New in this
   release and easy to miss.
2. **A viem chain definition and wagmi transport.** `CofheChain` carries `coFheUrl`,
   `verifierUrl` and `thresholdNetworkUrl` but **no host-chain RPC**, so the app still has to get
   one from somewhere.
3. **Confidential tokens deployed on 420105, and a tokenlist published for them**, for any app
   whose token set is per-chain. Without that there is nothing to shield, send, or decrypt and the
   retarget proves nothing.

Tell the developer this up front so they can decide whether it is ten minutes or a day, rather
than discovering it midway.

## Contract fixtures need redeploying

Any test fixture whose Solidity changed (see [contracts.md](contracts.md)) has new bytecode and must be
redeployed on every chain it targets.

## Verify

```bash
# all @cofhe/* on the same version
npm ls @cofhe/sdk @cofhe/react @cofhe/abi 2>/dev/null | grep '@cofhe/'

# exactly one copy of each contract package - more than one line here is the bug
npm ls @fhenixprotocol/cofhe-contracts fhenix-confidential-contracts 2>/dev/null \
  | grep -E 'cofhe-contracts|confidential-contracts'
```

Then connect a client and create a self ACP. If that succeeds, the chain is ACP-era and the
dependency set is coherent.
