# Confidential tokens (`fhenix-confidential-contracts` 0.3.x → 0.4.0)

Only relevant if the project depends on `fhenix-confidential-contracts` — the FHERC20 / ERC-7984
confidential token library. It is a **separate package on its own version line** (note the
unscoped name), and 0.4.0 is its ACP-era release.

```jsonc
"fhenix-confidential-contracts": "0.4.0"
```

Read [contracts.md](contracts.md) and [shared-euints.md](shared-euints.md) first. Everything here
is those two changes arriving through a dependency: `InEuint64` → `externalEuint64 + bytes`, and
bare `euint64` on a contract boundary → `sharedEuint64`. What makes this page separate is that the
decisions have already been made **for** the project — the library's interfaces are fixed, so
anything inheriting or calling them has to match rather than choose.

## Is it in scope?

```bash
# the dependency itself
grep -rn 'fhenix-confidential-contracts' --include=package.json --include=remappings.txt \
  --include=foundry.toml .

# inheritance and interface use
grep -rnE '\b(FHERC20|FHERC20Upgradeable|FHERC20ERC20Wrapper|FHERC20NativeWrapper|IERC7984|IFHERC20|IERC7984Receiver|ERC20Confidential)\b' \
  --include='*.sol' .

# client-side call sites
grep -rnE 'confidentialTransfer|confidentialBalanceOf|shield\(|unshield\(|claimUnshielded' \
  --include='*.ts' --include='*.tsx' --include='*.sol' .
```

A project can hit this page three ways, and they need different work:

| How it uses the library                                  | What follows                                      |
| -------------------------------------------------------- | ------------------------------------------------- |
| **Inherits** `FHERC20` / a wrapper / `ERC20Confidential` | signatures change under it; redeploy; relink      |
| **Calls** a confidential token (Solidity or TS)          | call sites change; the return type is now a share |
| **Implements** `IERC7984Receiver`                        | both encrypted values on the callback change type |

## 1. It requires `cofhe-contracts` at exactly `0.2.0`

0.4.0 declares `@fhenixprotocol/cofhe-contracts` as a **runtime dependency pinned to `0.2.0`** —
0.3.x had it only as a dev dependency. A project still pinning `0.2.0-beta.3` now resolves two
copies of `FHE.sol`, and the resulting errors are confusing rather than informative: two distinct
`sharedEuint64` types with the same name, so a value "is not" the type it plainly is. Bump the pin
before anything else here ([environment.md](environment.md)).

## 2. Transfer signatures: `InEuint64` → `externalEuint64 + bytes`, returning `sharedEuint64`

`IERC7984` / `IFHERC20` moved every mutative entry point. Both halves of each pair changed:

```solidity
// BEFORE (0.3.x)
function confidentialTransfer(address to, InEuint64 memory encryptedAmount) external returns (euint64);
function confidentialTransfer(address to, euint64 amount)                   external returns (euint64);

// AFTER (0.4.0)
function confidentialTransfer(address to, externalEuint64 encryptedAmount, bytes calldata inputProof)
    external returns (sharedEuint64);
function confidentialTransfer(address to, sharedEuint64 sharedAmount)
    external returns (sharedEuint64);
```

The same transformation applies to `confidentialTransferFrom`, `confidentialTransferAndCall` and
`confidentialTransferFromAndCall`. Note the proof sits **immediately after** the handle, with
`data` after it — the proof-follows-hash rule in [contracts.md](contracts.md), not a trailing slot.

The second overload is the important one to read carefully. It used to take a bare `euint64` and
rely on the caller having been granted ACL access out of band; it now takes a `sharedEuint64`, and
**the sharer must be the direct caller** because the token consumes the share with
`receiveEuint64Param`. A contract that shares the handle and then calls the token through an
intermediate hop reverts `UnexpectedSharer`.

```solidity
// calling the second overload from a contract
token.confidentialTransfer(to, FHE.shareEuint64(amount, address(token)));
```

The `sharedEuint64` **return** only matters to contract callers, who must consume it on the call
edge:

```solidity
euint64 sent = FHE.receiveEuint64FromCall(
  token.confidentialTransfer(to, FHE.shareEuint64(amount, address(token))),
  address(token)                        // the address called on this line
);
FHE.allowThis(sent);                    // transient until persisted
```

An EOA transaction discards return values, so a wallet-driven `confidentialTransfer` is unaffected
by the return-type change — only by the argument change.

These entry points also gained `nonReentrant` (OZ `ReentrancyGuardTransient`). A contract that
re-entered a token during a transfer callback now reverts instead of proceeding; that is a
behavioural change with no compile error, so check any receiver that calls back into the token.

## 3. `IERC7984Receiver` — both directions become shares

```solidity
// BEFORE
function onConfidentialTransferReceived(address operator, address from, euint64 amount, bytes calldata data)
    external returns (ebool);

// AFTER
function onConfidentialTransferReceived(address operator, address from, sharedEuint64 amount, bytes calldata data)
    external returns (sharedEbool);
```

[shared-euints.md](shared-euints.md) says to **ask** before moving the inbound value of a receiver
callback onto `sharedEuint64`, because receiving widens access. **That question is settled for this
library** — 0.4.0 made the choice, and an implementer's only job is to match:

```solidity
function onConfidentialTransferReceived(address operator, address from, sharedEuint64 amount, bytes calldata data)
    external returns (sharedEbool)
{
    euint64 value = FHE.receiveEuint64Param(amount);   // sharer must be msg.sender (the token)
    FHE.allowThis(value);                              // transient otherwise — persist if you keep it
    ...
    return FHE.shareEbool(accepted, msg.sender);       // directed back at the token
}
```

Two mistakes to watch for, neither of which the compiler catches:

- `receiveEboolParam` on the token side instead of `receiveEboolFromCall(retval, to)`. The library
  gets this right internally (`FHERC20Utils.checkOnTransferReceived`), but any hand-rolled
  callback dispatch in project code has to name the callee.
- forgetting `FHE.allowThis` on the unwrapped amount. The received handle is transient only, so a
  receiver that stores it works in the same transaction and fails in the next one.

`FHERC20Utils.checkOnTransferReceived` still returns a plain `ebool`, so callers of that internal
helper are unaffected.

## 4. Wrappers: `shield` / `unshield` return shares, and `unshield` gained an overload

```solidity
function shield(address to, uint256 amount)                external returns (sharedEuint64);  // was euint64
function unshield(address from, address to, uint64 amount)  external returns (sharedEuint64);  // was euint64
function unshield(address from, address to, sharedEuint64 sharedAmount) external returns (sharedEuint64);  // new
```

Same for `shieldWrappedNative` / `shieldNative` on the native wrapper. The new encrypted-amount
`unshield` overload lets a contract unshield without first revealing the amount as a `uint64`;
the caller must be `from` or an operator for `from`.

## 5. The `*Core` split — an inheritance change, not a behaviour change

Behaviour moved out of `FHERC20` and `FHERC20Upgradeable` into a shared `FHERC20Core`, which both
now host. `ERC20Confidential` / `ERC20ConfidentialUpgradeable` are new, over
`ERC20ConfidentialCoreUpgradeable`, for layering a confidential ledger on a host's public ERC-20.

For a subclass this is mostly invisible — `_mint`, `_burn`, `_transfer`, `_update`, `_setOperator`,
`balanceOf`, `confidentialBalanceOf` and `__FHERC20_init` all kept their names and signatures. Two
things do change:

- **`supportsInterface` moved to the hosts.** Overriding it from a subclass of `FHERC20` still
  works; overriding it on something that inherits `FHERC20Core` directly does not, because the core
  no longer declares it.
- **Storage for the non-upgradeable `FHERC20` moved into the ERC-7201 namespaced struct** that
  `FHERC20Upgradeable` always used. Irrelevant for a fresh deploy, which is the only thing a
  non-upgradeable token gets. **Upgradeable proxies keep their slot** (`fherc20.storage.FHERC20`)
  and upgrade cleanly — with one exception, below.

## 6. `ERC20ConfidentialLib` must be linked at deploy time (new)

The FHE orchestration now lives in `ERC20ConfidentialLib`, an **external library** that is
`delegatecall`ed, so the heavy logic is deployed once per chain instead of being embedded in every
token — this is what keeps tokens under the EIP-170 24KB limit.

Every contract inheriting `ERC20Confidential`, `ERC20ConfidentialUpgradeable`,
`ERC20ConfidentialCoreUpgradeable`, **or either wrapper** must be linked against it. Plain
`FHERC20` / `FHERC20Core` does not use the library and needs no linking.

```ts
const LIB_FQN = 'contracts/ERC20Confidential/ERC20ConfidentialLib.sol:ERC20ConfidentialLib';

const lib = await ethers.deployContract(LIB_FQN); // once per chain
await lib.waitForDeployment();

const factory = await ethers.getContractFactory('MyConfidentialToken', {
  libraries: { [LIB_FQN]: await lib.getAddress() },
});

// upgradeable tokens additionally need this, or the OZ plugin refuses the deploy
await upgrades.deployProxy(factory, [...args], { unsafeAllowLinkedLibraries: true });
```

This fails loudly at deploy time (unresolved link) rather than silently, so it is easy to diagnose
— but it is new work in every deploy script, test fixture and Ignition/hardhat-deploy module, and
the address is baked into the token's bytecode and **cannot be changed afterwards**. Treat the
library like a deployment of its own: record its address per chain and verify it on the explorer.

The linked-library warning in [contracts.md](contracts.md) Case A applies from here on — a future
library change means relinking and redeploying every host.

## 7. Unshield claims are re-keyed — this one can lose user funds in flight

`FHERC20WrapperClaimHelper` and `FHERC20WrapperClaimHelperUpgradeable` are replaced by a single
`FHERC20WrapperClaims`. Claims are now keyed by a **unique per-claimant id**
(`keccak256(to, nonce++, handle)`) rather than by the ciphertext handle, because CoFHE handles are
content-addressed: two unshields with an identical burned-amount lineage produce the same handle,
so handle-keyed claims could overwrite each other and redirect a payout.

```solidity
function getClaim(bytes32 id)          public view returns (ERC20ConfidentialLib.Claim memory);  // id, not ctHash
function getUserClaims(address user)   public view returns (ERC20ConfidentialLib.Claim[] memory);
```

Read ids from `getClaim` / `getUserClaims`. The handle is still there as `Claim.ctHash`, and still
what binds the decryption proof — so code that passed a handle where an id is now expected
typechecks (`bytes32` either way) and reverts `ClaimNotFound`. Grep for every `getClaim` call site.

`LengthMismatch` was also renamed to `ClaimBatchLengthMismatch`; a test asserting the old name
stops matching.

> **Stop and ask: pending claims do not survive the upgrade.** The new records live in the same
> ERC-7201 slot as the old helpers' but are **not layout-compatible** — different key derivation,
> and a leading `id` field. Upgrading a proxy with unclaimed unshields in flight orphans them: the
> underlying tokens are already burned on the confidential side and the claim can no longer be
> found. This is a data migration and a user-funds question, not a code change. Enumerate the
> outstanding claims on-chain before upgrading, and let the developer decide (drain first, migrate
> the records, or deploy fresh).

## 8. Also new, and optional

`FHESafeMath.trySpend(balance, amount)` returns `(success, updated, spent)` — an all-or-nothing
debit that hands back the amount actually removed, saving the caller an `FHE.select` when crediting
a counterparty. Nothing breaks without it; mention it if the project hand-rolls
`tryDecrease` + `select` in a transfer path, and leave the change to the developer.

## 9. Client-side call sites

The ABI change is ordinary for [encrypt-inputs.md](encrypt-inputs.md) — the encrypted argument
becomes a handle plus a batch signature:

```ts
// BEFORE
const [encAmount] = await client.encryptInputs([Encryptable.uint64(amount)]).execute();
await token.confidentialTransfer(to, encAmount);

// AFTER
const [handle, signature] = await client
  .encryptInputs([Encryptable.uint64(amount)])
  .setConsumingContract(tokenAddress) // the token, not the wallet
  .execute();
await token.confidentialTransfer(to, handle, signature);
```

`@cofhe/abi` (`insertEncryptedValues`, `useCofheEncryptAndWriteContract`) already handles this
shape: the `bytes` slot immediately after the run of `external*` parameters is the signature, which
is exactly how the `*AndCall` overloads are declared. Regenerate typechain/ABI artifacts — a stale
artifact still describing the `InEuint64` tuple encodes a call the contract cannot decode.

## Verify

```bash
forge build            # or: npx hardhat compile
```

Then, because none of these are compile-detectable:

```bash
# claim lookups that may be passing a handle where an id is now required
grep -rnE 'getClaim|getUserClaims|claimUnshielded' --include='*.ts' --include='*.tsx' --include='*.sol' .

# the old claim helper names and error
grep -rnE 'FHERC20WrapperClaimHelper|LengthMismatch' --include='*.ts' --include='*.sol' .

# deploy paths that must now link the library
grep -rnE 'getContractFactory|deployProxy|deployContract' --include='*.ts' . \
  | grep -iE 'confidential|wrapper|fherc20'

# exactly one copy of each contract package
npm ls @fhenixprotocol/cofhe-contracts fhenix-confidential-contracts 2>/dev/null \
  | grep -E 'cofhe-contracts|confidential-contracts'
```

Then exercise, on mocks or staging: a wallet-initiated `confidentialTransfer` (argument change), a
contract-to-contract one (share round trip), a transfer into a contract implementing
`IERC7984Receiver` (both share directions), and a shield → unshield → claim cycle (the new claim
id). A green compile covers none of these.

## Report

- **every unclaimed unshield found on a proxy being upgraded** — individually, as a funds risk
- the `ERC20ConfidentialLib` address deployed per chain, and whether it was explorer-verified
- any `IERC7984Receiver` implementation whose access widened, and what it can now read
- contracts left on the bare-`euint64` overload because a counterparty has not migrated
