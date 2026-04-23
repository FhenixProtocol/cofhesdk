// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import '@fhenixprotocol/cofhe-contracts/FHE.sol';

/**
 * Simple test contract for integration tests.
 * Accepts encrypted inputs and returns encrypted values.
 */
contract SimpleTest {
  euint32 public storedValue;
  bytes32 public storedValueHash;
  euint32 public publicValue;
  bytes32 public publicValueHash;

  function setValueTrivial(uint256 inValue) public {
    storedValue = FHE.asEuint32(inValue);
    storedValueHash = euint32.unwrap(storedValue);
    FHE.allowThis(storedValue);
    FHE.allowSender(storedValue);
  }

  function setPublicValue(InEuint32 memory inValue) public {
    publicValue = FHE.asEuint32(inValue);
    publicValueHash = euint32.unwrap(publicValue);
    FHE.allowPublic(publicValue);
  }

  function setValue(InEuint32 memory inValue) public {
    storedValue = FHE.asEuint32(inValue);
    storedValueHash = euint32.unwrap(storedValue);
    FHE.allowThis(storedValue);
    FHE.allowSender(storedValue);
  }

  function addValue(InEuint32 memory inValue) public {
    euint32 valueToAdd = FHE.asEuint32(inValue);
    storedValue = FHE.add(storedValue, valueToAdd);
    storedValueHash = euint32.unwrap(storedValue);
    FHE.allowThis(storedValue);
    FHE.allowSender(storedValue);
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
    publicValue = FHE.asEuint32(inValue);
    publicValueHash = euint32.unwrap(publicValue);
    FHE.allowPublic(publicValue);
  }

  function addValueTrivial(uint256 inValue) public {
    euint32 valueToAdd = FHE.asEuint32(inValue);
    storedValue = FHE.add(storedValue, valueToAdd);
    storedValueHash = euint32.unwrap(storedValue);
    FHE.allowThis(storedValue);
    FHE.allowSender(storedValue);
  }

  function getDecryptResultSafe(euint32 input) public view returns (uint32 value, bool decrypted) {
    return FHE.getDecryptResultSafe(input);
  }
}
