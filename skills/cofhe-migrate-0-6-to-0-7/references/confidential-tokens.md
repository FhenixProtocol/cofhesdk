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

## 7. Unshield claims — the most dangerous change in the release

Nothing in the toolchain catches any part of this. Read the whole section before touching a claim
call site.

`FHERC20WrapperClaimHelper` and `FHERC20WrapperClaimHelperUpgradeable` are replaced by a single
`FHERC20WrapperClaims`, over the linked library's claim store. The struct was **reshaped** and
claiming was **re-keyed**:

```solidity
// 0.3.x
struct Claim { address to; bytes32 ctHash; uint64 requestedAmount; uint64 decryptedAmount; bool claimed; }
function claimUnshielded(bytes32 ctHash, uint64 decryptedAmount, bytes decryptionProof);
function claimUnshieldedBatch(bytes32[] ctHashes, uint64[] amounts, bytes[] proofs);

// 0.4.0
struct Claim { bytes32 id; address to; bytes32 ctHash; uint64 decryptedAmount; bool claimed; }
function claimUnshielded(bytes32 id, uint64 decryptedAmount, bytes decryptionProof);
function claimUnshieldedBatch(bytes32[] ids, uint64[] amounts, bytes[] proofs);
```

Claims are keyed by a **unique per-claimant id** — `keccak256(to, nonce++, handle)` — rather than by
the ciphertext handle, because CoFHE handles are content-addressed: two unshields with an identical
burned-amount lineage produce the same handle, so handle-keyed claims could overwrite each other and
redirect a payout.

### (a) The selector did not change

`claimUnshielded(bytes32,uint64,bytes)` is the same signature, so the **same selector**, in both
versions. Only the meaning of the first argument moved. An unmigrated caller passing a `ctHash`
where an `id` is expected produces a well-formed transaction that reverts `ClaimNotFound` on chain.
No compile error, no ABI mismatch, no decode failure — nothing surfaces it but a live test. Treat
every `claimUnshielded` / `claimUnshieldedBatch` call site as an edit that must be made by hand and
verified on chain.

**Two `bytes32` values are now in play and they are not interchangeable:**

| Value          | What it is for                                                    |
| -------------- | ----------------------------------------------------------------- |
| `Claim.id`     | the lookup key — `getClaim(id)`, and the argument you submit      |
| `Claim.ctHash` | the burned handle — what you decrypt, and what the proof binds to |

So a claim submission decrypts one and submits the other:

```ts
const { decryptedValue, signature } = await client
  .decryptForTx(claim.ctHash) // ctHash
  .setChainId(chainId)
  .setAccount(account)
  .withoutACP()
  .execute();
await token.claimUnshielded(claim.id, decryptedValue, signature); //           id
```

Reversing them typechecks — both are `bytes32` / `Hex` — and fails on chain.

> **The library's own naming will mislead you here.** `IERC20ConfidentialCore` declares
> `claimUnshielded(bytes32 id, …)`, but `IERC20Confidential` still declares the same function as
> `claimUnshielded(bytes32 ctHash, …)`. The parameter name is cosmetic and the behaviour is the
> core's — it wants the id. Do not take the `ctHash` spelling in that one interface as evidence the
> old contract is in play.

### (b) `requestedAmount` is gone, and reading a pending amount is now a decrypt

The old struct carried a plaintext `requestedAmount`. It is removed, and there is no replacement
field: only the plaintext `unshield` overload ever filled it (the encrypted overload wrote 0), and
the unified implementation wraps a plaintext amount into a handle before `createClaim` runs, so
there is no plaintext left to record. There is no escape route — the struct has no other plaintext,
`TokensUnshielded` carries a `euint64`, and `UnshieldedTokensClaimed` emits cleartext only at
**claim** time, after the decrypt already happened.

**Showing a pending claim's amount therefore costs a decrypt per claim, under the holder's ACP**
(`decryptForView(claim.ctHash).withACP()`), with partial-failure semantics: a missing or expired
ACP, or a ciphertext the threshold network has not indexed, degrades the displayed total rather than
failing the query. `useCofheTokenClaimable` handles this and reports an `undecryptedCount` for the
claims it could not read, deliberately keeping them listed — an amount that cannot be read is not
the same as an amount that is not there, and hiding it would strand funds.

That is a UX and error-handling change, not a rename. An app that displayed `requestedAmount` needs
a story for "amount unknown". Three ways to avoid the decrypt entirely, if the developer prefers:
show count and state only; fold the amount into the claim action, where `decryptForTx` yields it
anyway; or cache it client-side at unshield time (same-device only, and untrusted).

**Claiming itself did not get harder.** The claim decrypt is `decryptForTx`, which needs **no ACP**,
and `claimUnshielded` always required a proven plaintext plus proof. Only the _display_ decrypt is
new. Keep the two separate when explaining this.

Worth carrying: `requestedAmount` was **already** unreliable in 0.3.x — an app using the encrypted
`unshield` overload was reading 0 from it all along.

### (c) `decryptedAmount > 0` is now dead logic

`getUserClaims` returns **only unclaimed** claims: `handleClaim` writes `decryptedAmount` and
removes the id from the claimant's set in the same call. So every claim it returns necessarily
carries `decryptedAmount == 0`.

Any code testing `decryptedAmount > 0n` to mean "ready to claim" is now a branch that can never be
true, and reports everything as pending forever. No type error, no runtime error — just a feature
that silently stops working. Grep for it.

### (d) Against un-upgraded contracts the decode is silent, not loud

Both structs are **five static slots**, so a migrated client reading an old contract decodes
successfully and misaligns: old `to` is read as `id`, old `ctHash` as `to`, old `requestedAmount` as
`ctHash`. The shape validation in `normalizeUnshieldClaims` only checks types, and every misaligned
field still has the right type, so every garbage row survives the filter.

The user sees a populated claims list of nonsense, display decrypts aimed at a meaningless `ctHash`
— which surface as `undecryptedCount`, indistinguishable from "no valid ACP" — and a claim
submission carrying a bogus id that reverts.

> **Do not exercise unshield from a migrated client against un-upgraded contracts on any chain that
> matters.** The call succeeds and creates a claim that cannot afterwards be read or claimed.

This is why the redeploy below is not optional.

### Redeploying the token contracts is mandatory

State this plainly rather than leaving it implied. Old contracts and new clients cannot interoperate
in either direction, for three independent reasons:

1. storage layout changed (claim records, and `FHERC20`'s move to the ERC-7201 struct);
2. the claim key changed under a **stable selector**, so the mismatch is silent;
3. `confidentialTransfer` and friends moved to `externalEuint64 + inputProof`.

`LengthMismatch` was also renamed to `ClaimBatchLengthMismatch`; a test asserting the old name stops
matching.

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
# claim lookups and submissions that may be passing a handle where an id is now required.
# SELECTOR-STABLE: none of these produce a compile error. Check each by hand.
grep -rnE 'getClaim|getUserClaims|claimUnshielded' --include='*.ts' --include='*.tsx' --include='*.sol' .

# the removed plaintext field, and readiness tests that can never be true again
grep -rnE 'requestedAmount|decryptedAmount\s*[>!=]' --include='*.ts' --include='*.tsx' --include='*.sol' .

# the old claim helper names and error
grep -rnE 'FHERC20WrapperClaimHelper|LengthMismatch' --include='*.ts' --include='*.sol' .

# hardcoded claim-struct ABIs - a 5-field tuple decodes either version without complaint
grep -rnE "requestedAmount|getUserClaims" --include='*.ts' --include='*.tsx' . | grep -iE 'abi|parseAbi|tuple'

# deploy paths that must now link the library
grep -rnE 'getContractFactory|deployProxy|deployContract' --include='*.ts' . \
  | grep -iE 'confidential|wrapper|fherc20'

# exactly one copy of each contract package
npm ls @fhenixprotocol/cofhe-contracts fhenix-confidential-contracts 2>/dev/null \
  | grep -E 'cofhe-contracts|confidential-contracts'
```

Then exercise, on mocks or staging: a wallet-initiated `confidentialTransfer` (argument change), a
contract-to-contract one (share round trip), a transfer into a contract implementing
`IERC7984Receiver` (both share directions), and a **full shield → unshield → display → claim cycle**.
A green compile covers none of these, and the claim path in particular has no compile-time signal at
all: the selector is stable, so the only proof it works is a claim that actually settles on chain.

Never truncate a verification run. Piping `tsc --noEmit` through `head` while unrelated errors fill
the budget is how a real defect in this area gets reported as "0 errors" — run it whole, then filter
by path if the output is large.

## Report

- **every unclaimed unshield found on a proxy being upgraded** — individually, as a funds risk
- **every `claimUnshielded` / `getClaim` call site**, whether it was changed and how it was verified
  — the selector is stable, so "it compiles" is not evidence
- any place that displayed `requestedAmount`, and what it shows now for an undecryptable claim
- any `decryptedAmount > 0` readiness test found, since it was silently always false
- the `ERC20ConfidentialLib` address deployed per chain, and whether it was explorer-verified
- any `IERC7984Receiver` implementation whose access widened, and what it can now read
- contracts left on the bare-`euint64` overload because a counterparty has not migrated
