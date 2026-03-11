// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

// Remix should be able to resolve this npm-style import.
// If it fails in your environment, replace it with a direct URL import, e.g.
// import "https://unpkg.com/@fhenixprotocol/cofhe-contracts@0.1.0/FHE.sol";
import '@fhenixprotocol/cofhe-contracts/FHE.sol';

/// @title EncryptedCounter (Remix)
/// @notice Minimal encrypted counter used for docs + quick testing.
/// @dev Calls `FHE.allowPublic` so the encrypted value can be decrypted by anyone.
contract EncryptedCounter {
  euint32 private _value;

  constructor(uint32 initialValue) {
    _value = FHE.asEuint32(initialValue);
    FHE.allowThis(_value);
    FHE.allowSender(_value);
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
