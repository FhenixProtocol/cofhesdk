# Sharing encrypted values between contracts (`sharedEuintXX`)

`@fhenixprotocol/cofhe-contracts` 0.2.0 introduces one `sharedEuintXX` type per encrypted type.
Two specific shapes have to move onto it — and the inclusion rule is narrower than "crosses a
contract boundary", so apply it literally:

> **In scope:** `public` / `external` **parameters that another contract passes**, and `euint*` > **returned from `public` / `external` non-`view` functions**.
>
> **Out of scope:** `internal` and `private` functions. Library functions running inside their host.
> Anything only ever reached from within the same contract. A `bytes32` that is not a handle.

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

**Check whether the entry point already gates before calling it a disclosure.** A function that
opens with `FHE.isAllowed(amount, msg.sender)` — or any equivalent check that the _caller_ holds the
handle — is not an oracle: an attacker cannot name the contract's own storage ciphertext, because
they are not allowed on it. Migrating it still buys provenance (which contract directed this value,
in this transaction), which is worth having, but it is a hardening step rather than a leak.

Say which one each site is when reporting. Calling every hit a disclosure trains the developer to
discount the ones that really are.

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
- **`delegatecall` libraries.** A library invoked by `delegatecall` executes as its host: `msg.sender`
  and the ACL's view of custody are the host's, so there is no boundary being crossed and nothing to
  authenticate. The greps below **will** hit its internal `euint64` plumbing. Skip it. Converting it
  is not merely unnecessary — the library has no separate identity to share to or from.
- **Callbacks that hand you a value you are not allowed on.** See below.

## EOA-facing entry points

An EOA cannot create a share — `FHE.shareEuint64` is an `internal` Solidity function, so a wallet
has no way to write a share slot. That does **not** mean bare-handle entry points should stay as
they are:

> **A user calling directly from a wallet is expected to supply an `externalEuintXX` plus its proof,
> not a handle they already hold.** A function taking a bare `euintXX` from an EOA should usually
> become a Case A conversion ([contracts.md](contracts.md)) — `externalEuint64 + bytes` — not a
> `sharedEuintXX`.

So the three shapes are:

| Who calls it                                 | What the parameter should be             |
| -------------------------------------------- | ---------------------------------------- |
| Another contract                             | `sharedEuintXX` + `receive*`             |
| A wallet, supplying a fresh value            | `externalEuintXX` + `bytes` proof        |
| A wallet, supplying a handle it already owns | bare `euintXX` — **advanced, see below** |

### The advanced pattern: accepting a handle the user already owns

This is legitimate — a user passing back their own balance handle from a public getter, for
example — but it is the exact shape described in the oracle section above, and it is the most
dangerous thing in this document.

**If you keep a bare `euintXX` parameter, you must check the caller holds it:**

```solidity
function unshield(euint64 amount) external {
  if (!FHE.isAllowed(amount, msg.sender)) revert NotYourCiphertext();
  ...
}
```

Without that check the function will happily compute on **any** handle the contract is allowed on,
including its own storage, and hand the result to whoever asked — potentially exposing every
encrypted value the contract holds.

**Default to converting.** Prefer `sharedEuintXX` or `externalEuintXX` and let the developer revert
a specific site back to the guarded bare-handle form if they genuinely need it. Converting too much
is a compile error they will notice; leaving an unguarded bare handle in place is a silent
disclosure path they will not.

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

**`try`/`catch` counts as the same call edge.** Callback boundaries are written this way precisely
so a failing receiver can be tolerated, which puts the receive in the success block rather than the
call expression. That is still `FromCall`, naming the address you called:

```solidity
try IERC7984Receiver(to).onConfidentialTransferReceived(operator, from, FHE.shareEuint64(amount, to), data)
returns (sharedEbool retval) {
    return FHE.receiveEboolFromCall(retval, to);   // RIGHT - `to` is the callee, one line up
} catch (bytes memory reason) { ... }
```

`receiveEboolParam` compiles here and is **wrong**: it checks `msg.sender`, which on this side is
whoever called _you_, not the receiver that produced the value.

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

**Leaving a share unconsumed is fine.** A receiver that decides on other grounds and never unwraps
the value costs nothing — the slot clears at the end of the transaction. The warning in the
call-edge rule is about _naming the wrong callee_, not about leaving a share unused.

New errors to expect while wiring this up: `NotShared` (no share pending for you),
`UnexpectedSharer` (a share is pending, but from someone other than the party you named),
`SenderNotAllowed` (the sharer does not hold the handle).

## Receiver callbacks are two cases, not one

A transfer-with-callback interface (`IERC7984Receiver.onConfidentialTransferReceived` and the same
shape elsewhere) carries an encrypted value **in** and an `ebool` acknowledgement **out**. They
migrate differently:

| Direction                               | Migrate?                                                             |
| --------------------------------------- | -------------------------------------------------------------------- |
| `euint64 amount` **into** the callback  | **Ask first.** Often the receiver is deliberately not allowed on it. |
| `ebool` success **out** of the callback | **Yes** — a real S2 handoff (`allowTransient` → `shareEbool`).       |

The inbound value is the subtle one. In many implementations the receiver is handed a handle it has
no ACL access to — it can record or forward it but not compute on it. Moving that parameter to
`sharedEuint64` **widens** access, because receiving grants transient use. That may be exactly what
the protocol wants, or may quietly hand a counterparty something it was never meant to read. It is
a design decision: surface it, do not apply it.

> **Except when the interface already decided.** `fhenix-confidential-contracts` 0.4.0 declares
> `IERC7984Receiver.onConfidentialTransferReceived` as `(…, sharedEuint64 amount, …) returns
(sharedEbool)`. A project implementing that interface has no choice to make — match it, then
> report what the receiver can now read. See
> [confidential-tokens.md](confidential-tokens.md).

The outbound `ebool` has no such ambiguity — the callback is handing a value back to its caller, and
the caller consumes it with `receiveEboolFromCall`.

## Report as a table, then wait

The greps are wide on purpose and will over-match. Do not migrate straight off them. Turn the hits
into one table, show it, and get agreement before editing:

| Contract | Function | Case | Visibility | Called by another contract? | Action |
| -------- | -------- | ---- | ---------- | --------------------------- | ------ |

`Case` is S1 or S2. Rows that fail the inclusion rule — internal, library-internal,
`delegatecall`-only, not actually a handle — belong in the table marked **skip**, with the reason.
Showing what was ruled out is what makes the ruled-in set reviewable.

### Triage before calling anything a disclosure

Migrate eagerly, but **report precisely**. A bare-handle site is only a live oracle if an arbitrary
caller can reach it with a handle _this contract_ is allowed on. These defuse it:

- `if (!FHE.isAllowed(value, msg.sender)) revert …` — the caller must already hold the handle, so
  they cannot name the contract's own state.
- the same check one level down, in a function this one delegates to.
- the value is authenticated another way, e.g. a decryption proof for an already-public value.
- the function is `public` only so a library can be `delegatecall`ed, and no host exposes it.

Report genuine oracles as **security findings** and the rest as a **provenance backlog**. In one
real migration this was the difference between 21 reported findings and the 1 that mattered —
conflating them buries it.

## Stop and ask

- **A handle is passed through more than two contracts**, or re-shared onward. Each hop needs its
  own share/receive pair, and who names whom is a design decision.

Third-party counterparties are **not** a reason to stop. This migration is happening across the
ecosystem, so assume the contract on the other end migrates in lockstep — convert your side, note
the counterparty in the report, and move on. Do not leave a boundary half-migrated waiting for
confirmation.

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

- `@fhenixprotocol/cofhe-contracts` **0.2.0** (stable). The types and helpers are absent from
  `0.2.0-beta.1`; a project pinned there fails to compile with
  `Identifier not found or not unique: sharedEuint64`. `0.2.0-beta.3` has them, but pin the stable
  `0.2.0` — and make sure only one copy resolves, or the same type name from two copies of
  `FHE.sol` produces mismatch errors that read like nonsense
  ([environment.md](environment.md)).
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
