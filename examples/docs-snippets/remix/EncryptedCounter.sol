// SPDX-License-Identifier: UNLICENSED

// [!region docs-snippet]
pragma solidity ^0.8.28;

// Remix-friendly import: pulls the CoFHE contracts from npm CDN.
// Remix can resolve nested imports (including @openzeppelin) when fetching remote sources.
import 'https://unpkg.com/@fhenixprotocol/cofhe-contracts@0.1.0/FHE.sol';

/// @title EncryptedCounter
/// @notice Minimal encrypted counter used for docs + runnable examples.
/// @dev Calls `FHE.allowPublic` so the encrypted value can be decrypted by anyone.
///      Use this pattern only for demo/public data.
contract EncryptedCounter {
  euint32 private _value;

  constructor(uint32 initialValue) {
    _value = FHE.asEuint32(initialValue);
    _allow(_value);
  }

  /// @notice Returns an encrypted handle (ctHash) for `_value`.
  function getValue() external view returns (euint32) {
    return _value;
  }

  function increment() external {
    _value = FHE.add(_value, FHE.asEuint32(1));
    _allow(_value);
  }

  function _allow(euint32 v) internal {
    FHE.allowThis(v);
    FHE.allowSender(v);
    FHE.allowPublic(v);
  }
}
// [!endregion docs-snippet]
