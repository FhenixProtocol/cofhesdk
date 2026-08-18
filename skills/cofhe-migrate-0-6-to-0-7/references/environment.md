# Dependencies, chain, and mock deployments

Do this first. If the chain can't serve ACPs, nothing downstream matters.

## Dependency bump

```jsonc
{
  "@cofhe/sdk": "^0.7.0",
  "@cofhe/react": "^0.7.0",
  "@cofhe/abi": "^0.7.0",
  "@cofhe/hardhat-plugin": "^0.7.0", // or @cofhe/hardhat-3-plugin
  "@cofhe/foundry-plugin": "^0.7.0",
  "@cofhe/mock-contracts": "^0.7.0",
  "@fhenixprotocol/cofhe-contracts": "0.2.x",
}
```

Every `@cofhe/*` package must be on the same version. Mixed versions produce type errors that
look like migration bugs but aren't.

> **Check the exact `cofhe-contracts` version this release pins.** It shipped against a
> `0.2.0-beta.*` prerelease; confirm the final version before pinning it in a production project.

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

## Contract fixtures need redeploying

Any test fixture whose Solidity changed (see [contracts.md](contracts.md)) has new bytecode and must be
redeployed on every chain it targets.

## Verify

```bash
# all @cofhe/* on the same version
npm ls @cofhe/sdk @cofhe/react @cofhe/abi 2>/dev/null | grep '@cofhe/'
```

Then connect a client and create a self ACP. If that succeeds, the chain is ACP-era and the
dependency set is coherent.
