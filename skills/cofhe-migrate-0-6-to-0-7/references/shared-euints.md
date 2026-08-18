# Sharing encrypted values between contracts (`sharedEuintXX`)

**This is additive. Nothing in 0.6.x breaks because of it, and no project is required to adopt
it.** Load this reference for two reasons only:

1. The project hand-rolls contract-to-contract sharing with `FHE.allowTransient` and a bare
   `bytes32`/`euintXX` parameter — there is now a typed, safer way to spell it, worth **offering**
   once the required migration is green.
2. The project has its own mock-based tests that depend on transient allowances surviving across
   transactions — those **will** break. See _The mock transient-storage change_ below. That part
   is not optional.

Do not rewrite working sharing code as part of the migration. Finish the required work first,
then raise this as a follow-up.

## What 0.2.x adds

Seven new types alongside the `external*` family, one per encrypted type:

```solidity
type sharedEbool is bytes32;
type sharedEuint8 is bytes32;
type sharedEuint16 is bytes32;
type sharedEuint32 is bytes32;
type sharedEuint64 is bytes32;
type sharedEuint128 is bytes32;
type sharedEaddress is bytes32;
```

| Type              | Comes from                      | Lifetime                     |
| ----------------- | ------------------------------- | ---------------------------- |
| `externalEuint64` | a user, offchain                | verified once, then yours    |
| `sharedEuint64`   | another contract                | one transaction              |
| `euint64`         | your own storage or computation | as long as the ACL allows it |

Plus three helpers per type, shown here for `euint64`:

| Function                                     | Use                                                       |
| -------------------------------------------- | --------------------------------------------------------- |
| `FHE.shareEuint64(value, receiver)`          | hand a value to `receiver` for this transaction           |
| `FHE.receiveEuint64Param(shared)`            | consume a share that arrived **as a function argument**   |
| `FHE.receiveEuint64FromCall(shared, callee)` | consume a share that arrived **as a call's return value** |

and two `ITaskManager` entry points behind them, `shareCtHash(ctHash, receiver)` and
`receiveCtHash(ctHash, expectedSharer)`.

The mechanism is a directed, single-use, transaction-scoped share slot in the ACL: `share` grants
`receiver` transient access and records the sharer; `receive` consumes that record, requires the
recorded sharer to be who the receiver named, and re-checks the sharer still holds the handle.

## When it applies

```bash
# hand-rolled sharing: a transient grant aimed at another contract
grep -rn 'allowTransient' --include='*.sol' .

# ... paired with an untyped handle crossing a contract boundary
grep -rnE 'function .*\b(bytes32|euint(8|16|32|64|128)|ebool|eaddress)\b.*\)\s*(external|public)' --include='*.sol' .
```

A function that takes a bare `euint64`/`bytes32` from another contract and relies on the caller
having called `allowTransient` first is the pattern this replaces. If nothing matches, skip this
reference entirely.

## Before / after

```solidity
// BEFORE - 0.6.x: untyped handle, permission granted out of band, sharer unverifiable
contract Vault {
  function pushToToken(Token token, euint64 amount) external {
    FHE.allowTransient(amount, address(token));
    token.pull(euint64.unwrap(amount));            // just a bytes32 on the wire
  }
}

contract Token {
  function pull(bytes32 handle) external {
    euint64 amount = euint64.wrap(handle);         // trusts whoever called
    ...
  }
}
```

```solidity
// AFTER - 0.2.x: the type carries the permission, and the sharer is checked
contract Vault {
  function pushToToken(Token token, euint64 amount) external {
    token.pull(FHE.shareEuint64(amount, address(token)));
  }
}

contract Token {
  function pull(sharedEuint64 shared) external {
    euint64 amount = FHE.receiveEuint64Param(shared);   // sharer must be our caller
    ...
  }
}
```

`FHE.shareEuint64` reverts `SenderNotAllowed` unless the sharing contract is itself allowed on the
handle — you cannot share what you cannot use.

## The call-edge rule — get this one right

The two `receive` forms are not interchangeable, and picking the wrong one silently weakens the
check:

| How the value reached you           | Use                      | Sharer is checked against  |
| ----------------------------------- | ------------------------ | -------------------------- |
| An argument to your function        | `receiveEuint64Param`    | your caller (`msg.sender`) |
| The return value of a call you made | `receiveEuint64FromCall` | the contract you called    |

`receiveEuint64FromCall(shared, callee)` — **`callee` must be the address called in the same
expression.** Naming a merely-trusted address instead makes the call check who _created_ the
share rather than who _handed it over_, which is exploitable: a share left unconsumed earlier in
the transaction can be presented by an attacker, and naming its original creator satisfies the
check.

```solidity
// RIGHT - the address called is the address named
euint64 result = FHE.receiveEuint64FromCall(token.pull(shared), address(token));

// WRONG - no call on this line, so there is no callee to name
euint64 amount = FHE.receiveEuint64FromCall(shared, trustedSharer);
```

If the value arrived as a parameter, use `Param`. It reads `msg.sender` itself and takes no
address, so it cannot be spelled wrong.

## What it does not give you

- **Persistence.** A received handle carries transient access only. To keep it past this
  transaction, call `FHE.allowThis` on the unwrapped `euintXX`, not on the `sharedEuintXX`.
- **A stored or replayed share.** Share slots clear at end of transaction, so a `sharedEuintXX`
  reconstructed from storage or an event reverts `NotShared`.
- **Business-logic safety.** Nothing stops a contract sharing a handle it legitimately holds but
  should not disclose.

New errors to expect while wiring this up: `NotShared` (no share pending for you),
`UnexpectedSharer` (a share is pending but from someone else), `SenderNotAllowed` (the sharer does
not hold the handle).

## The mock transient-storage change — not optional

`@cofhe/mock-contracts` 0.7.0 replaces `MockACL`'s old approximation of transient storage — which
recorded `block.number` and treated an allowance as live for the rest of the **block** — with real
EIP-1153 transient storage, and implements `cleanTransientStorage()` rather than leaving it a
no-op. The share slot requires per-transaction semantics, and this also makes the mock faithful to
the production ACL.

**A transient allowance now expires at the end of its own transaction, not the end of the block.**

Any test that granted a transient allowance in one transaction and relied on it in a later
transaction of the same block now fails, typically as `SenderNotAllowed` from a subsequent
`allow`. Disabling automine and batching the calls into one block does **not** rescue it —
transient storage is per-transaction regardless of block packing.

Tests that fabricated bare handles and bootstrapped permissions this way should instead mint
handles the way production does: have a contract create the value and call `FHE.allowThis` /
`FHE.allowSender` / `FHE.allow`. The ACL has no cold-start path to a persisted allowance — `allow`
requires the requester to already be allowed, and in production that comes from `createTask`.

## Requirements

- `@fhenixprotocol/cofhe-contracts` **0.2.0-beta.3 or later**. The types and helpers are absent
  from `0.2.0-beta.1`; a project pinned there fails to compile with
  `Identifier not found or not unique: sharedEuint64`.
- An ACL and TaskManager deployment carrying `shareCtHash` / `receiveCtHash`. Live on CoFHE
  staging and the host chain; the mocks in `@cofhe/mock-contracts` 0.7.0 support it locally.
  Against a deployment that predates it, the share call reverts.

## Verify

```bash
forge build            # or: npx hardhat compile
```

Then exercise one round trip and assert the receiver actually got the value — a share that is
never consumed fails silently at the type level and only shows up as `ACLNotAllowed` when the
receiver tries to compute on the handle.
