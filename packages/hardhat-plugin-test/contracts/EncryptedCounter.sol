// SPDX-License-Identifier: UNLICENSED

// [!region docs-snippet]
pragma solidity ^0.8.28;

import '@fhenixprotocol/cofhe-contracts/FHE.sol';

/// @title EncryptedCounter
/// @notice Minimal encrypted counter used for docs + runnable examples.
/// @dev This contract calls `FHE.allowPublic` so the encrypted value can be decrypted by anyone.
///      Use this pattern only for demo/public data.
contract EncryptedCounter {
  euint32 private _value;

  constructor(uint32 initialValue) {
    _value = FHE.asEuint32(initialValue);
    FHE.allowThis(_value);
    FHE.allowSender(_value);
    // Makes `_value` publicly decryptable (anyone can decrypt the handle).
    FHE.allowPublic(_value);
  }

  /// @notice Returns an encrypted handle (ctHash) for `_value`.
  function getValue() external view returns (euint32) {
    return _value;
  }

  function increment() external {
    _value = FHE.add(_value, FHE.asEuint32(1));
    FHE.allowThis(_value);
    FHE.allowSender(_value);
    FHE.allowPublic(_value);
  }
}
// [!endregion docs-snippet]
