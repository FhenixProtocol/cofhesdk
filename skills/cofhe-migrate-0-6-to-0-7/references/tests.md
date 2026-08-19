# Tests

Load this once the source changes compile. Test suites break in ways the source does not, and one
of them — EOAs and `sharedEuintXX` — has no workaround at the call site and will look like a bug in
the migration.

## EOAs cannot produce a share

This is the big one. After a Case S1 migration
([shared-euints.md](shared-euints.md)), every test that had an EOA hand a handle straight to a
contract is dead:

```ts
// DEAD after S1 - there is no way to make this work from an EOA
await token.connect(alice)['unshield(bytes32)'](handle);
await token.connect(alice).confidentialTransfer(to, handle);
```

`FHE.shareEuint64` is an **`internal` Solidity function**. An EOA cannot execute Solidity, so it
cannot create a share slot. Wrapping a raw handle as `sharedEuint64` client-side and sending it
reverts `NotShared` — the slot the receiver looks for was never written.

Nor can it be split across transactions: share slots are transaction-scoped, so "share in tx 1,
call in tx 2" clears in between.

**The fix is a helper contract**, not a change at the call site. Something that holds the value,
shares it, and makes the call in one transaction:

```solidity
contract ShareHelper {
  function pushTo(IToken token, externalEuint64 inAmount, bytes memory proof) external {
    euint64 amount = FHE.asEuint64(inAmount, proof);   // helper is now allowed on it
    token.pull(FHE.shareEuint64(amount, address(token)));
  }
}
```

```ts
// the EOA drives the helper; the helper does the sharing
await helper.connect(alice).pushTo(tokenAddress, hash, proof);
```

Do **not** try to give the EOA a shared overload. If the test is really about an EOA calling the
token directly, that path should stay on the plaintext or `external*` + proof overload — those are
unaffected by S1 and remain the correct user-facing entry point.

## Negative tests change their error

Access-control tests that asserted a project-specific error now get an ACL-level one, and the two
failure modes are distinct:

| The test does                                     | New revert                    |
| ------------------------------------------------- | ----------------------------- |
| Shares a handle the sharer is not allowed on      | `SenderNotAllowed(sharer)`    |
| Wraps a raw handle as `sharedEuintXX` and calls   | `NotShared(handle, receiver)` |
| Consumes a share that came from a different party | `UnexpectedSharer(exp, act)`  |

Whatever the project's old "you may not use this ciphertext" error was, it is no longer what these
tests see. Update the expected error rather than the assertion's intent.

## Overload selector strings

`InEuint64` was a tuple `(uint256,uint8,uint8,bytes)`; `externalEuint64` is a plain `bytes32`. Every
explicit overload selector in the test suite changes shape:

```ts
// BEFORE
token['confidentialTransfer(address,(uint256,uint8,uint8,bytes))'](to, input);
// AFTER
token['confidentialTransfer(address,bytes32,bytes)'](to, hash, proof);
```

These are **strings**, so `tsc` cannot catch them. They fail at runtime with a missing-method error
that reads like the contract is wrong. Grep for tuple-shaped selectors:

```bash
grep -rnE "\(uint256,uint8,uint8,bytes\)" --include='*.ts' --include='*.tsx' .
```

ERC-165 interface ids have the same problem, and worse: they are keccak hashes of the signature set,
so a stale constant is a silently wrong value rather than an error. **Recompute them; do not port
the old bytes.**

## Fixtures must return the proof

A fixture that used to return one struct now has to return two values, because the signature is a
separate argument:

```ts
// BEFORE
const encAmount = await encryptAmount(100);
await token.confidentialTransfer(to, encAmount);

// AFTER
const [hash, proof] = await encryptAmount(100);
await token.confidentialTransfer(to, hash, proof);
```

Any fixture still returning only the handle will typecheck at its own definition and fail at every
call site. For `*AndCall`-style functions the trailing call data stays last, after the pair:
`(to, hash, proof, data)`.

## Consuming contract in tests

Same trap as production code, and easier to get wrong in a fixture that is reused across contracts:
the consuming contract is the one that will call `FHE.asEuint*`, not necessarily the one the test
calls. See [encrypt-inputs.md](encrypt-inputs.md).

A fixture hardcoding one address and being reused against two contracts produces a runtime revert
in only the second — which reads as a flaky test.

## Prove it with the negative test

The round trip passing shows the happy path works. The **negative** test is what proves the oracle is
closed, and it has two traps:

**Assert the specific revert.** `expect(...).to.be.reverted` passes on any failure — a typo, a gas
issue, an unrelated `require` — so it proves nothing. Pin the error.

**The error is declared by the ACL, not by your contract.** A custom-error matcher needs the ACL's
ABI, so `revertedWithCustomError(yourContract, 'NotShared')` will not match:

```ts
const aclAbi = await ethers.getContractAt('MockACL', ethers.ZeroAddress);
await expect(receiver.onConfidentialTransferReceived(a, b, unsharedHandle, '0x')).to.be.revertedWithCustomError(
  aclAbi,
  'NotShared'
);
```

## Verify

Run **both** suites; a project with Foundry and Hardhat tests will have distinct failures in each,
and passing one says nothing about the other.

```bash
forge build && forge test
npx hardhat compile && npx hardhat test
npx tsc --noEmit          # include the test files, not just src
```
