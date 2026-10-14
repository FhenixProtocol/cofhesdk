// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import '@fhenixprotocol/cofhe-contracts/FHE.sol';

error ForcedRevert();

interface IPullTarget {
  function pull(sharedEuint64 shared) external returns (sharedEuint64);
}

/**
 * Receiver that follows the call-edge rule: the handle arrives as a parameter, so the sharer must
 * be the caller. Uses `receiveEuint64Param`.
 */
contract SharedToken is IPullTarget {
  mapping(address => euint64) public credited;
  address public lastCreditedTo;
  bytes32 public lastReceivedHandle;

  /// @dev Test hook: makes `pull` revert for one specific caller, so a sharer can be driven down a
  ///      try/catch path and leave its share unconsumed.
  address public revertOnPullFrom;

  function setRevertOnPullFrom(address caller) external {
    revertOnPullFrom = caller;
  }

  function pull(sharedEuint64 shared) external returns (sharedEuint64) {
    if (msg.sender == revertOnPullFrom) revert ForcedRevert();

    // Argument arrival — the sharer must be whoever called us.
    euint64 amount = FHE.receiveEuint64Param(shared);
    lastReceivedHandle = euint64.unwrap(amount);

    euint64 result = FHE.div(amount, FHE.asEuint64(2));
    FHE.allowThis(result);
    credited[msg.sender] = result;
    lastCreditedTo = msg.sender;

    return FHE.shareEuint64(result, msg.sender);
  }

  function creditedHandle(address account) external view returns (bytes32) {
    return euint64.unwrap(credited[account]);
  }
}

/**
 * Same receiver, spelled the way the docs forbid: names a trusted sharer instead of the party that
 * delivered the handle. Exists so the presenter-substitution test can prove the attack is otherwise
 * live — without it, asserting "SharedToken reverts" would pass vacuously.
 */
contract SharedTokenUnsafe is IPullTarget {
  address public trustedSharer;
  address public lastCreditedTo;
  address public revertOnPullFrom;

  function setTrustedSharer(address sharer) external {
    trustedSharer = sharer;
  }

  function setRevertOnPullFrom(address caller) external {
    revertOnPullFrom = caller;
  }

  function pull(sharedEuint64 shared) external returns (sharedEuint64) {
    if (msg.sender == revertOnPullFrom) revert ForcedRevert();

    // WRONG: no call on this line, so there is no callee. This authenticates the sharer and
    // leaves the presenter unconstrained.
    euint64 amount = FHE.receiveEuint64FromCall(shared, trustedSharer);

    euint64 result = FHE.div(amount, FHE.asEuint64(2));
    FHE.allowThis(result);
    lastCreditedTo = msg.sender;

    return FHE.shareEuint64(result, msg.sender);
  }
}

/**
 * Sharer side. Holds per-user encrypted balances and exercises each way a share can be produced.
 */
contract SharedVault {
  mapping(address => euint64) public balances;
  euint64 public lastResult;

  function setBalance(address user, uint64 value) external {
    euint64 v = FHE.asEuint64(value);
    FHE.allowThis(v);
    balances[user] = v;
  }

  function balanceHandle(address user) external view returns (bytes32) {
    return euint64.unwrap(balances[user]);
  }

  function lastResultHandle() external view returns (bytes32) {
    return euint64.unwrap(lastResult);
  }

  /// Full round trip: share out, receive the result back off the same call.
  function roundTrip(IPullTarget token, address user) external {
    sharedEuint64 shared = FHE.shareEuint64(balances[user], address(token));

    // Return-value arrival — the sharer is the contract we called.
    euint64 result = FHE.receiveEuint64FromCall(token.pull(shared), address(token));

    FHE.allowThis(result);
    lastResult = result;
  }

  /// Shares, then swallows a failing call — leaves the slot live for the rest of the transaction.
  function pushToToken(IPullTarget token, address user) external {
    sharedEuint64 shared = FHE.shareEuint64(balances[user], address(token));
    try token.pull(shared) returns (sharedEuint64) {
      // consumed
    } catch {
      // swallowed
    }
  }

  /// Shares without calling anyone. Used for cross-transaction expiry.
  function shareOnly(IPullTarget token, address user) external {
    FHE.shareEuint64(balances[user], address(token));
  }

  /// One share, two receives — the second must fail.
  function shareOnceReceiveTwice(IPullTarget token, address user) external {
    sharedEuint64 shared = FHE.shareEuint64(balances[user], address(token));
    token.pull(shared);
    token.pull(shared);
  }

  /// Directs the share at `other`, then hands it to `token` anyway.
  function shareToWrongReceiver(IPullTarget token, address other, address user) external {
    sharedEuint64 shared = FHE.shareEuint64(balances[user], other);
    token.pull(shared);
  }

  /// Attempts to share a handle this contract was never allowed on.
  function shareForeignHandle(IPullTarget token, bytes32 foreignHandle) external {
    FHE.shareEuint64(euint64.wrap(foreignHandle), address(token));
  }

  /// Hands over a handle nobody shared.
  function pullWithoutSharing(IPullTarget token, address user) external {
    token.pull(sharedEuint64.wrap(euint64.unwrap(balances[user])));
  }
}

/**
 * Presenter substitution. Not a reentrancy: the attacker orchestrates the transaction, calling the
 * vault and then the token in sequence. The share written during the first call is still live
 * during the second.
 */
contract SharedAttacker {
  function attack(SharedVault vault, IPullTarget token, address victim) external {
    // Vault shares the victim's handle with `token`; its own pull reverts and is swallowed.
    vault.pushToToken(token, victim);

    // Same transaction, slot still live. Present the dangling share as our own.
    token.pull(sharedEuint64.wrap(vault.balanceHandle(victim)));
  }
}
