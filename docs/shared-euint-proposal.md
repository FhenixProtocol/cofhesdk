# Proposal: `sharedEuint` — encrypted data movement between contracts

**Status:** draft
**Affects:** `@fhenixprotocol/cofhe-contracts` (`FHE.sol`, `ICofhe.sol`, `ACL.sol`, `TaskManager.sol`), `@cofhe/mock-contracts` (`MockACL`, `MockTaskManager`)

## Summary

One `sharedEuintXX` type per encrypted type, for contract → contract movement only, plus share/receive helpers.

```solidity
type sharedEuint64 is bytes32;   // between contracts
type externalEuint64 is bytes32; // from users
type euint64 is bytes32;         // within a contract
```

`externalEuint64` covers user → contract. `sharedEuint64` covers contract → contract — currently hand-rolled
from `allowTransient` plus an untyped `bytes32`, indistinguishable at the type level from a locally-owned
handle.

Mechanism: a directed, single-use, transaction-scoped **share slot** in the ACL. `shareCtHash` grants
transient access and records the sharer; `receiveCtHash` consumes the record. One TaskManager round trip
per side.

## Design

The ACL already owns all transient permission state, so the slot lives there:

```
shareSlot(handle, receiver) -> sharer
```

- `shareCtHash(handle, receiver)` grants `receiver` transient access **and** records the sharer.
- `receiveCtHash(handle, expectedSharer)` reads the slot at `(handle, receiver)`, clears it, requires the
  recorded sharer to be `expectedSharer`, and re-checks that sharer is still allowed on the handle.

**sharer** = the contract handing a handle over; **receiver** = the contract taking it.

Both are reached by external call into the TaskManager, so each gets its own frame and `msg.sender` there
is unambiguously the sharer / the receiver — the property the inlined helper lacked, and it holds whether
the handle travels as an argument or a return value.

Properties:

- **Directed** — keyed by receiver; nobody else can claim it.
- **Single-use** — cleared on claim.
- **Transaction-scoped** — transient storage clears at end of transaction; no cross-transaction replay.
- **One round trip** — slot lookup, sharer match and custody re-check all happen inside `receiveCtHash`.

The slot's existence proves a valid share exists; it does not say who **presented** the handle. `receiveCtHashFromCall` requires the caller to
name the delivering party as it is ambiguous and msg.sender is incorrect.

## `FHE.sol`

Seven shared types, mirroring the `external*` family:

```solidity
type sharedEbool is bytes32;
type sharedEuint8 is bytes32;
type sharedEuint16 is bytes32;
type sharedEuint32 is bytes32;
type sharedEuint64 is bytes32;
type sharedEuint128 is bytes32;
type sharedEaddress is bytes32;
```

Shown for `euint64`; generated identically for all seven.

```solidity
/// @notice Grant `receiver` transient access to `ctHash` and direct it at `receiver` for this transaction.
/// @dev Reverts unless this contract is itself allowed on `ctHash`.
function shareEuint64(euint64 ctHash, address receiver) internal returns (sharedEuint64) {
    ITaskManager(TASK_MANAGER_ADDRESS).shareCtHash(uint256(euint64.unwrap(ctHash)), receiver);
    return sharedEuint64.wrap(euint64.unwrap(ctHash));
}

/// @notice Consume a share that arrived as an argument to the enclosing function.
/// @dev Inlined into the receiver, so `msg.sender` is the receiver's caller — read automatically,
///      nothing to pass. Reverts NotShared / UnexpectedSharer, both raised by the ACL.
function receiveEuint64Param(sharedEuint64 shared) internal returns (euint64) {
    bytes32 handle = sharedEuint64.unwrap(shared);
    ITaskManager(TASK_MANAGER_ADDRESS).receiveCtHash(uint256(handle), msg.sender);
    return euint64.wrap(handle);
}

/// @notice Consume a share that arrived as the return value of a call this contract made.
/// @param callee MUST be the address called in the same expression.
function receiveEuint64FromCall(sharedEuint64 shared, address callee) internal returns (euint64) {
    bytes32 handle = sharedEuint64.unwrap(shared);
    ITaskManager(TASK_MANAGER_ADDRESS).receiveCtHash(uint256(handle), callee);
    return euint64.wrap(handle);
}
```

### Which receive to use

| How the value reached you       | Use                      | Sharer must be          |
| ------------------------------- | ------------------------ | ----------------------- |
| Argument to the function        | `receiveEuint64Param`    | your caller             |
| Return value of a call you made | `receiveEuint64FromCall` | the contract you called |

There is no third case — a `sharedEuintXX` cannot outlive its transaction, so anything wrapped from storage
or an event has no slot and reverts `NotShared`.

## `ICofhe.sol` / `TaskManager.sol`

Additive; no existing signature changes.

```solidity
interface ITaskManager {
    /// @dev Reverts SenderNotAllowed unless msg.sender is allowed on `ctHash`.
    function shareCtHash(uint256 ctHash, address receiver) external;

    /// @param expectedSharer Required, so a share cannot be consumed without naming who it came from.
    /// @dev Reverts NotShared if none pending, UnexpectedSharer on mismatch. Slot is cleared —
    ///      a share is claimable exactly once.
    function receiveCtHash(uint256 ctHash, address expectedSharer) external;
}
```

Thin passthroughs; the TaskManager injects `msg.sender` as sharer on one side and receiver on the other,
and forwards `expectedSharer` untouched.

```solidity
function shareCtHash(uint256 ctHash, address receiver) external {
    acl.shareCtHash(ctHash, msg.sender, receiver);
}

function receiveCtHash(uint256 ctHash, address expectedSharer) external {
    acl.receiveCtHash(ctHash, expectedSharer, msg.sender);
}
```

Both ACL calls read `(handle, sharer, receiver)` — source then destination.

Neither carries `onlyAccessListed`: `createTask` / `verifyInput` have it, `allow*` do not, and sharing is
permission management.

## `ACL.sol`

Share slots belong here, not in the TaskManager. The ACL already keeps transient allowances in EIP-1153
storage — keyed `keccak256(abi.encodePacked(handle, account))`, written `tstore(key, 1)`, with a cleanup
index at slot 0 — while the production TaskManager holds no transient state at all. Same lifetime, same
cleanup path, same key convention.

The existing transient write is extracted so `allowTransient` and `shareCtHash` share one implementation,
including the index bookkeeping both must participate in for `cleanTransientStorage()` to stay correct.

```solidity
error NotShared(uint256 handle, address receiver);
error UnexpectedSharer(address expected, address actual);

/// @dev Domain separator — share keys must not alias allowance keys, which carry no prefix.
bytes32 private constant SHARE_DOMAIN = keccak256("cofhe.acl.share");

function _shareKey(uint256 handle, address receiver) private pure returns (bytes32) {
    return keccak256(abi.encodePacked(SHARE_DOMAIN, handle, receiver));
}

/// @dev tstore + append to the cleanup index at slot 0. Every transient write goes through here.
function _tstoreTracked(bytes32 key, uint256 value) private {
    assembly ("memory-safe") {
        tstore(key, value)
        let length := tload(0)
        let lengthPlusOne := add(length, 1)
        tstore(lengthPlusOne, key)
        tstore(0, lengthPlusOne)
    }
}

/// @dev Callers are responsible for the custody check.
function _allowTransient(uint256 handle, address account) internal {
    _tstoreTracked(keccak256(abi.encodePacked(handle, account)), 1);
}

function allowTransient(uint256 handle, address account, address requester) public virtual {
    if (msg.sender != TASK_MANAGER_ADDRESS) revert DirectAllowForbidden(msg.sender);
    if (!isAllowed(handle, requester) && requester != TASK_MANAGER_ADDRESS) {
        revert SenderNotAllowed(requester);
    }
    _allowTransient(handle, account);
}

function shareCtHash(uint256 handle, address sharer, address receiver) public virtual {
    if (msg.sender != TASK_MANAGER_ADDRESS) revert DirectAllowForbidden(msg.sender);

    // Stricter than allowTransient: no TASK_MANAGER_ADDRESS bypass. Nothing shares on the
    // TaskManager's own behalf, so the sharer must genuinely hold the handle.
    if (!isAllowed(handle, sharer)) revert SenderNotAllowed(sharer);

    _allowTransient(handle, receiver);                                     // capability
    _tstoreTracked(_shareKey(handle, receiver), uint256(uint160(sharer))); // provenance
}

function receiveCtHash(uint256 handle, address expectedSharer, address receiver) public virtual {
    if (msg.sender != TASK_MANAGER_ADDRESS) revert DirectAllowForbidden(msg.sender);

    bytes32 shareKey = _shareKey(handle, receiver);
    address sharer;
    assembly ("memory-safe") {
        sharer := tload(shareKey)
        tstore(shareKey, 0)
    }
    if (sharer == address(0)) revert NotShared(handle, receiver);
    if (sharer != expectedSharer) revert UnexpectedSharer(expectedSharer, sharer);
    if (!isAllowed(handle, sharer)) revert SenderNotAllowed(sharer);
}
```

- **Failed claims consume nothing.** The slot is cleared before the checks, but the `tstore` rolls back
  with the reverting frame, leaving the share available to its intended receiver.
- **Cleanup consistency is load-bearing.** `receiveCtHash` does not verify the _receiver's_ transient
  grant, so "live slot implies live allowance" rests on both being written and cleared together. Routing
  share keys through `_tstoreTracked` is what makes `cleanTransientStorage()` clear them alongside
  allowances. Any change that clears allowances without clearing slots would hand back an unusable handle,
  surfacing later as an opaque `ACLNotAllowed`. Keep both on `_tstoreTracked`, or add an
  `allowedTransient(handle, receiver)` check. (`receiveCtHash` also clears its own slot; the index then
  points at an already-zero slot, which is a harmless no-op.)
- **Custody re-checked on claim.** `cleanTransientStorage()` can lapse the sharer's own grant mid
  transaction, and a lapsed sharer means the recorded provenance is no longer backed by anything.
- **Provenance encoding.** `sharer` is stored as a clean `uint160`, so the `tload` needs no masking.

## Cost

|                     | Manual `allowTransient` / `isAllowed` | This proposal                                          |
| ------------------- | ------------------------------------- | ------------------------------------------------------ |
| Sharer side         | 1 call → TaskManager → ACL            | 1 call → TaskManager → ACL                             |
| Receiver side       | 1 call → TaskManager → ACL            | 1 call → TaskManager → ACL                             |
| Extra transient ops | —                                     | 1 `tstore` on share; 1 `tload` + 1 `tstore` on receive |

Identical call topology plus ~300 gas of transient storage.

## Worked example

```solidity
contract Vault {
    function pushToToken(Token token, externalEuint64 _inAmount, bytes32 _proof) external {
        euint64 amount = FHE.asEuint64(_inAmount, _proof);
        sharedEuint64 shared = FHE.shareEuint64(amount, address(token));

        // return-value arrival — sharer is the contract we called
        euint64 result = FHE.receiveEuint64FromCall(token.pull(shared), address(token));

        FHE.allowThis(result); // transient only until persisted
    }
}

contract Token {
    function pull(sharedEuint64 shared) external returns (sharedEuint64) {
        // argument arrival — sharer is our caller
        euint64 amount = FHE.receiveEuint64Param(shared);

        euint64 result = FHE.div(amount, FHE.asEuint64(2));
        return FHE.shareEuint64(result, msg.sender);
    }
}
```

The receiver passes no address; the sharer passes the address it is already calling on that line.

## Security properties

**Guaranteed**

- _Directedness_ — keyed by receiver, so a third party cannot consume a share addressed to someone else.
- _Chain of custody_ — `shareCtHash` reverts unless the sharer is allowed, and `receiveCtHash` re-asserts
  it on claim.
- _No presenter substitution_ — the sharer is bound to the party that delivered the handle. Unconditional
  for `Param`; for `FromCall` it holds as long as `callee` is the contract actually called.
- _Symmetry_ — identical semantics for argument and return-value arrival.
- _Single use_ — one `share` authorizes exactly one `receive`.
- _No cross-transaction replay_ — transient storage clears at end of transaction.

**Not guaranteed**

- _Persistence_ — a received handle carries transient access only; storing it needs `FHE.allowThis`.
- _Business-logic correctness_ — nothing stops a contract sharing a handle it legitimately holds but should
  not disclose.
- _Cross-width confusion_ — distinct UDVTs stop `receiveEuint64` on a `sharedEbool` at compile time; manual
  `wrap`/`unwrap` defeats that, but the handle's type byte makes downstream ops fail.

## Rollout

1. **`pnpm patch @fhenixprotocol/cofhe-contracts@0.1.4`** — types and `FHE` functions in `FHE.sol`,
   `ITaskManager` additions in `ICofhe.sol`.
2. **Mocks** — `shareCtHash` / `receiveCtHash` in `MockACL` and `MockTaskManager`, plus the neighbouring
   `MOCK_log` hooks.
3. **Tests** — `Vault.sol` / `Token.sol` fixtures and a Hardhat suite covering the round trip, single-use
   enforcement, unshared claim, wrong-receiver claim, unauthorized-sharer revert, and cross-transaction
   expiry. Plus an `Attacker.sol` fixture reproducing
   [presenter substitution](#presenter-substitution) against a `Token` using `Param` — asserts
   `UnexpectedSharer`. Pair it with a second `Token` misusing `FromCall(shared, address(vault))` at a
   parameter site and assert the attack **succeeds**: without it the first assertion passes vacuously
   whenever the setup is subtly wrong, and it is the only thing pinning the `FromCall` review rule.
4. **Upstream** — PRs to `cofhe-contracts` for the library and interface, and to the `ACL` / `TaskManager`
   deployments.

Steps 1–3 work against the mocks immediately; nothing works against real CoFHE until step 4 ships. A
standalone `FHEShared.sol` for consumers who cannot patch is possible but does not remove the deployment
dependency.
