// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import '@fhenixprotocol/cofhe-contracts/FHE.sol'; // [!code focus]

// @title EncryptedCounter
// Minimal encrypted counter for docs and runnable examples
contract EncryptedCounter /* [!code focus] */ {
  // Contract owner; only they can set/increment count or allow public decryption.
  address public owner;

  // [!region encrypted-state-variable]
  // The counter value, stored as an encrypted euint32. [!code focus]
  euint32 public count; // [!code focus]
  // [!endregion encrypted-state-variable]

  // True after revealCount has been called with a valid decrypt proof.
  bool public decrypted;
  // The last revealed count value; meaningful only when decrypted is true.
  uint32 public decryptedCount;

  error OnlyOwnerAllowed(address caller);

  // Initializes the counter with an encrypted representation of initialValue.
  // initialValue Plaintext value; converted to euint32 and allowed for this contract and deployer.
  constructor(uint32 initialValue) {
    owner = msg.sender;
    count = FHE.asEuint32(initialValue);
    FHE.allowThis(count);
    FHE.allowSender(count);
  }

  modifier onlyOwner() {
    if (msg.sender != owner) revert OnlyOwnerAllowed(msg.sender);
    _;
  }

  // [!region encrypt-input]
  // Sets the count to a new value from an encrypted input. [!code focus]
  // Client flow: build input with cofheClient.encryptInputs(...).execute(), then call this with the result. [!code focus]
  // -- [!code focus]
  // <_inCount> Encrypted input (InEuint32) produced by the client. [!code focus]
  function setCount(/* [!code focus] */ InEuint32 memory _inCount) external onlyOwner {
    count = FHE.asEuint32(_inCount); // [!code focus]
    FHE.allowThis(count); // [!code focus]
    FHE.allowSender(count); // [!code focus]
    decrypted = false; // [!code focus]
    decryptedCount = 0; // [!code focus]
  } // [!code focus]
  // [!endregion encrypt-input]

  // [!region get-count]
  // Returns the current count as an encrypted handle (ctHash). [!code focus]
  // Use cofheClient.decryptForView(...) to decrypt off-chain. euint32 is bytes32, often shown as string. [!code focus]
  function getValue(/* [!code focus] */) external view returns (euint32) {
    return count; // [!code focus]
  } // [!code focus]
  // [!endregion get-count]

  // [!region increment-count]
  // Increments the count by 1 using FHE addition.
  // Updates allowances and clears any previously revealed value, like setCount.
  function incrementCount() external onlyOwner {
    count = FHE.add(count, FHE.asEuint32(1));
    FHE.allowThis(count);
    FHE.allowSender(count);
    decrypted = false;
    decryptedCount = 0;
  }
  // [!endregion increment-count]

  // [!region allow-count-publicly]
  // Allows anyone to decrypt the count (no permit required). [!code focus]
  // After this, clients can use cofheClient.decryptForTx(...).withoutPermit().execute(). [!code focus]
  function allowCountPublicly(/* [!code focus] */) external onlyOwner {
    FHE.allowPublic(count); // [!code focus]
  } // [!code focus]
  // [!endregion allow-count-publicly]

  // [!region decrypt-for-tx-usage]
  // Stores the count as plaintext after verifying a decrypt-for-tx proof. [!code focus]
  // Client flow: call cofheClient.decryptForTx(...).execute(), then pass the returned value and signature here. [!code focus]
  // Will revert if <count> has updated since the proof was created. [!code focus]
  // -- [!code focus]
  // <_decrypted> The decrypted count from the client. [!code focus]
  // <_signature> Proof that _decrypted matches the current count. [!code focus]
  function revealCount(/* [!code focus] */ uint32 _decrypted, bytes memory _signature) external {
    FHE.verifyDecryptResult(count, _decrypted, _signature); // [!code focus]
    decrypted = true; // [!code focus]
    decryptedCount = _decrypted; // [!code focus]
  } // [!code focus]
  // [!endregion decrypt-for-tx-usage]
} // [!code focus]
