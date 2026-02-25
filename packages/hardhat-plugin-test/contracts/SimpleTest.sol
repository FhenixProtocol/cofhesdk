// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import '@fhenixprotocol/cofhe-contracts/FHE.sol';

/**
 * Simple test contract for Hardhat network
 * Accepts encrypted inputs and returns encrypted values
 */
contract SimpleTest {
  euint32 public storedValue;
  uint256 public storedValueHash;
  euint32 public publicValue;
  uint256 public publicValueHash;

  function setValueTrivial(uint256 inValue) public {
    storedValue = FHE.asEuint32(inValue);
    storedValueHash = uint256(euint32.unwrap(storedValue));
    FHE.allowThis(storedValue);
    FHE.allowSender(storedValue);
  }

  /**
   * Set a globally accessible encrypted value (everyone can decrypt)
   * @param inValue The encrypted value to set globally
   */
  function setPublicValue(InEuint32 memory inValue) public {
    publicValue = FHE.asEuint32(inValue);
    publicValueHash = uint256(euint32.unwrap(publicValue));
    FHE.allowPublic(publicValue);
  }

  /**
   * Store an encrypted value
   * @param inValue The encrypted value to store
   */
  function setValue(InEuint32 memory inValue) public {
    storedValue = FHE.asEuint32(inValue);
    storedValueHash = uint256(euint32.unwrap(storedValue));
    FHE.allowThis(storedValue);
    FHE.allowSender(storedValue);
  }

  /**
   * Add an encrypted value to the stored value
   * @param inValue The encrypted value to add
   */
  function addValue(InEuint32 memory inValue) public {
    euint32 valueToAdd = FHE.asEuint32(inValue);
    storedValue = FHE.add(storedValue, valueToAdd);
    storedValueHash = uint256(euint32.unwrap(storedValue));
    FHE.allowThis(storedValue);
    FHE.allowSender(storedValue);
  }

  /**
   * Get the stored encrypted value
   * @return The encrypted value
   */
  function getValue() public view returns (euint32) {
    return storedValue;
  }

  /**
   * Get the hash of the stored encrypted value
   * @return The hash of the stored encrypted value
   */
  function getValueHash() public view returns (uint256) {
    return storedValueHash;
  }
}
