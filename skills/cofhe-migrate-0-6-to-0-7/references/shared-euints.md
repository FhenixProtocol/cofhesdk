# Sharing encrypted values between contracts (`sharedEuintXX`)

0.2.x introduces one `sharedEuintXX` type per encrypted type, and **every place an encrypted value
crosses a contract boundary has to move onto it**:

- a function that **receives** an encrypted value from another contract, and
- a **non-view** function that **returns** an encrypted value to its caller.

> **The compiler will not find these for you.** The 0.6.x spelling — an `allowTransient` grant plus
> a bare `euintXX`/`bytes32` on the wire — still compiles and still executes. These sites have to
> be found by search, and the greps below are the whole detection story. Do not treat a clean
> `forge build` as evidence there is nothing to do here.

The old spelling is not merely untyped, it is an **antipattern with a concrete disclosure risk** —
left in place it can expose every ciphertext the contract holds. Treat these sites as security
work, report them individually, and do not let them be deferred as cleanup.

## Why it changed — a bare handle parameter is a decryption oracle

This is the part to lead with when explaining the work to a developer. It is not a style
preference: **a function taking a bare `euintXX` from outside can be turned into an oracle over
every ciphertext the contract holds.**

FHE operations check the permission of the **contract performing them**, not of whoever called it.
`FHE.div(amount, ...)` succeeds whenever the contract is allowed on `amount` — and a contract is
always allowed on its own stored state. So a function like this:

```solidity
function pull(euint64 amount) external returns (euint64) {
  euint64 result = FHE.div(amount, FHE.asEuint64(2));
  FHE.allowThis(result);
  FHE.allowTransient(result, msg.sender);   // hand the derived value back to the caller
  return result;
}
```

does not just serve the counterparty it was written for. Anyone can call it, and anyone can pass
**any handle the contract is allowed on** — handles are plain `bytes32`, readable from storage,
events, or a public getter. The attacker names one of the contract's own private ciphertexts, the
operation passes the ACL check because the _contract_ holds it, and the function hands back a value
derived from it that the attacker is now permitted to persist and decrypt. Repeat per handle and
the contract's encrypted state is readable.

The root cause is that a bare handle carries no provenance. The receiver can see that it is allowed
to use a ciphertext, but not **who handed it over** or whether it was handed over at all.

`sharedEuintXX` closes it. The mechanism is a directed, single-use, transaction-scoped share slot in
the ACL: `share` grants `receiver` transient access and records the sharer; `receive` consumes that
record, requires the recorded sharer to be who the receiver named, and re-checks that the sharer
still holds the handle. An attacker calling `pull` with a handle nobody shared reverts `NotShared`,
because a value now has to be deliberately directed at this contract, by name, in this transaction.

The same reasoning applies to Case S2. Returning an encrypted value with a bare
`FHE.allowTransient(result, msg.sender)` grants the value to whoever called — which, on a function
that never authenticated its caller, is whoever asked.

## What does _not_ change

- **`view` / `pure` functions returning an encrypted value.** They cannot grant anything — sharing
  writes transient state through the TaskManager — so returning a `euintXX` from a view function
  was never a permission handoff. The caller has to be allowed by some other route already. Leave
  these alone.
- **Values that never leave the contract**, and values arriving from a user. Those are `euintXX`
  and `externalEuint32` respectively.

| Type              | Comes from                      | Lifetime                     |
| ----------------- | ------------------------------- | ---------------------------- |
| `externalEuint64` | a user, offchain                | verified once, then yours    |
| `sharedEuint64`   | another contract                | one transaction              |
| `euint64`         | your own storage or computation | as long as the ACL allows it |

## Find the affected functions

```bash
# 1. the out-of-band permission grant that marks the old pattern
grep -rn 'allowTransient' --include='*.sol' .

# 2. functions taking an encrypted value that is NOT from a user (external*) - candidates for S1
grep -rnE 'function [A-Za-z0-9_]+\([^)]*\b(euint(8|16|32|64|128)|ebool|eaddress|bytes32)\b' \
  --include='*.sol' .

# 3. non-view functions returning an encrypted value - candidates for S2
grep -rnE 'returns\s*\([^)]*\b(euint(8|16|32|64|128)|ebool|eaddress)\b' --include='*.sol' . \
  | grep -vE '\bview\b|\bpure\b'
```

Grep 2 is deliberately wide — it catches internal helpers and same-contract plumbing too. Keep only
the functions another **contract** calls; a `bytes32` parameter that is really a handle is the easy
one to miss.

## Case S1 — receiving an encrypted value from another contract

```solidity
// BEFORE - permission granted out of band, sharer unverifiable
contract Vault {
  function pushToToken(Token token, euint64 amount) external {
    FHE.allowTransient(amount, address(token));
    token.pull(amount);                                // just a handle on the wire
  }
}

contract Token {
  // Anyone can call this with any handle Token is allowed on - including Token's own state.
  function pull(euint64 amount) external {
    euint64 half = FHE.div(amount, FHE.asEuint64(2));  // ACL checks Token, not the caller
    ...
  }
}
```

```solidity
// AFTER - the type carries the permission, and the sharer is checked
contract Vault {
  function pushToToken(Token token, euint64 amount) external {
    token.pull(FHE.shareEuint64(amount, address(token)));
  }
}

contract Token {
  function pull(sharedEuint64 shared) external {
    euint64 amount = FHE.receiveEuint64Param(shared);   // sharer must be our caller
    euint64 half = FHE.div(amount, FHE.asEuint64(2));
    ...
  }
}
```

The explicit `FHE.allowTransient` disappears — `shareEuint64` grants the transient access itself.
It reverts `SenderNotAllowed` unless the sharing contract is allowed on the handle: you cannot
share what you cannot use.

**This changes the ABI.** `pull(euint64)` and `pull(sharedEuint64)` are both `bytes32` on the wire,
so callers you do not control keep compiling against the old signature and fail at runtime with
`NotShared`. Every caller must be migrated in the same change, and the contract redeployed.

## Case S2 — returning an encrypted value from a non-view function

```solidity
// BEFORE
contract Token {
  function pull(euint64 amount) external returns (euint64) {
    euint64 result = FHE.div(amount, FHE.asEuint64(2));
    FHE.allowThis(result);
    FHE.allowTransient(result, msg.sender);            // hand it back out of band
    return result;
  }
}

contract Vault {
  function pushToToken(Token token, euint64 amount) external {
    euint64 back = token.pull(amount);                 // cannot tell this came from `token`
    ...
  }
}
```

```solidity
// AFTER
contract Token {
  function pull(sharedEuint64 shared) external returns (sharedEuint64) {
    euint64 amount = FHE.receiveEuint64Param(shared);
    euint64 result = FHE.div(amount, FHE.asEuint64(2));
    FHE.allowThis(result);
    return FHE.shareEuint64(result, msg.sender);       // directed back at the caller
  }
}

contract Vault {
  function pushToToken(Token token, euint64 amount) external {
    euint64 back = FHE.receiveEuint64FromCall(
      token.pull(FHE.shareEuint64(amount, address(token))),
      address(token)                                   // the address called on this line
    );
    FHE.allowThis(back);                               // still transient until persisted
    ...
  }
}
```

Both sides of a round trip usually need both cases at once, as above.

## The call-edge rule — get this one right

The two `receive` forms are not interchangeable, and picking the wrong one silently weakens the
check rather than failing:

| How the value reached you           | Use                      | Sharer is checked against  |
| ----------------------------------- | ------------------------ | -------------------------- |
| An argument to your function        | `receiveEuint64Param`    | your caller (`msg.sender`) |
| The return value of a call you made | `receiveEuint64FromCall` | the contract you called    |

`receiveEuint64FromCall(shared, callee)` — **`callee` must be the address called in that same
expression.** Naming a merely-trusted address instead checks who _created_ the share rather than
who _handed it over_, which is exploitable: a share left unconsumed earlier in the transaction can
be presented by an attacker, and naming its original creator satisfies the check.

```solidity
// RIGHT - the address called is the address named
euint64 result = FHE.receiveEuint64FromCall(token.pull(shared), address(token));

// WRONG - no call on this line, so there is no callee to name
euint64 amount = FHE.receiveEuint64FromCall(shared, trustedSharer);
```

If the value arrived as a parameter, use `Param`. It reads `msg.sender` itself and takes no
address, so it cannot be spelled wrong. **Flag any `FromCall` whose second argument is not the
receiver of the call on that line for the developer to review.**

## What it does not give you

- **Persistence.** A received handle carries transient access only. To keep it past this
  transaction, call `FHE.allowThis` on the unwrapped `euintXX`, not on the `sharedEuintXX`.
- **A stored or replayed share.** Share slots clear at end of transaction, so a `sharedEuintXX`
  reconstructed from storage or an event reverts `NotShared`.
- **Business-logic safety.** Nothing stops a contract sharing a handle it legitimately holds but
  should not disclose.

New errors to expect while wiring this up: `NotShared` (no share pending for you),
`UnexpectedSharer` (a share is pending, but from someone other than the party you named),
`SenderNotAllowed` (the sharer does not hold the handle).

## Stop and ask

- **A counterparty contract is third-party.** Both sides of a handoff have to migrate together.
  If the developer does not control the contract on the other end, they are blocked until it
  migrates — say so plainly rather than generating a side that cannot work.
- **A handle is passed through more than two contracts**, or re-shared onward. Each hop needs its
  own share/receive pair, and who names whom is a design decision.

## The mock transient-storage change

`@cofhe/mock-contracts` 0.7.0 replaces `MockACL`'s old approximation of transient storage — which
recorded `block.number` and treated an allowance as live for the rest of the **block** — with real
EIP-1153 transient storage, and implements `cleanTransientStorage()` rather than leaving it a
no-op. The share slot requires per-transaction semantics, and this also makes the mock faithful to
the production ACL.

**A transient allowance now expires at the end of its own transaction, not the end of the block.**

Any test that granted a transient allowance in one transaction and relied on it in a later
transaction of the same block now fails, typically as `SenderNotAllowed` from a subsequent `allow`.
Disabling automine and batching the calls into one block does **not** rescue it — transient storage
is per-transaction regardless of block packing.

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

A clean build proves nothing here — the old spelling compiles too. Confirm the migration by
exercising a round trip and asserting the receiver got the value, and by re-running the greps above
and checking every remaining hit is deliberate.

For each site left unmigrated, ask the oracle question directly: _can an arbitrary caller reach this
function with a handle this contract is allowed on, and learn something about the result?_ If yes,
it is a live disclosure path and belongs in the report as such, not in a cleanup list.
