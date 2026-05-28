// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import '@fhenixprotocol/cofhe-contracts/FHE.sol';

/**
 * Shared CoFHE test fixture used across integration, mock, and inherited test flows.
 * Accepts encrypted inputs and exposes encrypted values plus decrypt-result helpers.
 */
contract SimpleTest {
  euint32 public storedValue;
  bytes32 public storedValueHash;
  euint32 public publicValue;
  bytes32 public publicValueHash;

  function _setStoredValue(euint32 value) internal {
    storedValue = value;
    storedValueHash = euint32.unwrap(value);
    FHE.allowThis(value);
    FHE.allowSender(value);
  }

  function _setPublicValue(euint32 value) internal {
    publicValue = value;
    publicValueHash = euint32.unwrap(value);
    FHE.allowPublic(value);
  }

  function setValueTrivial(uint256 inValue) public {
    _setStoredValue(FHE.asEuint32(inValue));
  }

  function setPublicValue(InEuint32 memory inValue) public {
    _setPublicValue(FHE.asEuint32(inValue));
  }

  function setValue(InEuint32 memory inValue) public {
    _setStoredValue(FHE.asEuint32(inValue));
  }

  function addValue(InEuint32 memory inValue) public {
    euint32 valueToAdd = FHE.asEuint32(inValue);
    _setStoredValue(FHE.add(storedValue, valueToAdd));
  }

  function getValue() public view returns (euint32) {
    return storedValue;
  }

  function getValueHash() public view returns (bytes32) {
    return storedValueHash;
  }

  function publishDecryptResult(euint32 input, uint32 result, bytes memory signature) external {
    FHE.publishDecryptResult(input, result, signature);
  }

  function setPublicValueTrivial(uint256 inValue) public {
    _setPublicValue(FHE.asEuint32(inValue));
  }

  function addValueTrivial(uint256 inValue) public {
    euint32 valueToAdd = FHE.asEuint32(inValue);
    _setStoredValue(FHE.add(storedValue, valueToAdd));
  }

  function getDecryptResultSafe(euint32 input) public view returns (uint32 value, bool decrypted) {
    return FHE.getDecryptResultSafe(input);
  }
}
