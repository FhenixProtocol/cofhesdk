// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import '@fhenixprotocol/cofhe-contracts/FHE.sol';

/**
 * Simple test contract for Hardhat network
 * Accepts encrypted inputs and returns encrypted values
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

  /**
   * Set a globally accessible encrypted value (everyone can decrypt)
   * @param inValue The encrypted value to set globally
   */
  function setPublicValue(InEuint32 memory inValue) public {
    publicValue = FHE.asEuint32(inValue);
    publicValueHash = euint32.unwrap(publicValue);
    FHE.allowPublic(publicValue);
  }

  /**
   * Store an encrypted value
   * @param inValue The encrypted value to store
   */
  function setValue(InEuint32 memory inValue) public {
    storedValue = FHE.asEuint32(inValue);
    storedValueHash = euint32.unwrap(storedValue);
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
    storedValueHash = euint32.unwrap(storedValue);
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
  function getValueHash() public view returns (bytes32) {
    return storedValueHash;
  }

  /**
   * Publish a decryption result produced by the Threshold Network.
   * @param input  The encrypted handle that was decrypted.
   * @param result The plaintext result returned by the TN.
   * @param signature The TN signature over (ctHash, result).
   */
  function publishDecryptResult(euint32 input, uint32 result, bytes memory signature) external {
    FHE.publishDecryptResult(input, result, signature);
  }

  /**
   * Read a decryption result without reverting if it is not yet available.
   * @param input The encrypted handle to query.
   * @return value     The decrypted value (0 if not yet decrypted).
   * @return decrypted Whether the result has been published.
   */
  function getDecryptResultSafe(euint32 input) public view returns (uint32 value, bool decrypted) {
    return FHE.getDecryptResultSafe(input);
  }
}
