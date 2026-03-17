// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import '@fhenixprotocol/cofhe-contracts/FHE.sol';

contract EncryptedCounter {
  address public owner;

  // [!region encrypted-state-variable]
  euint32 public count;
  // [!endregion encrypted-state-variable]
  bool public decrypted;
  uint32 public decryptedCount;

  constructor(uint32 initialValue) {
    owner = msg.sender;
    count = FHE.asEuint32(initialValue);
    FHE.allowThis(count);
    FHE.allowSender(count);
  }

  error OnlyOwnerAllowed(address caller);

  modifier onlyOwner() {
    if (msg.sender != owner) revert OnlyOwnerAllowed(msg.sender);
    _;
  }

  // [!region get-count]
  function getCount() external view returns (euint32) {
    return count;
  }
  // [!endregion get-count]

  // [!region encrypt-input]
  function setCount(InEuint32 memory _inCount) external onlyOwner {
    count = FHE.asEuint32(_inCount);
    FHE.allowThis(count);
    FHE.allowSender(count);
    decrypted = false;
    decryptedCount = 0;
  }
  // [!endregion encrypt-input]

  // [!region increment-count]
  function incrementCount() external onlyOwner {
    count = FHE.add(count, FHE.asEuint32(1));
    FHE.allowThis(count);
    FHE.allowSender(count);
    decrypted = false;
    decryptedCount = 0;
  }
  // [!endregion increment-count]

  // [!region allow-count-publicly]
  function allowCountPublicly() external onlyOwner {
    FHE.allowPublic(count);
  }
  // [!endregion allow-count-publicly]

  // [!region decrypt-for-tx-usage]
  function revealCount(uint32 _decrypted, bytes memory _signature) external {
    FHE.verifyDecryptResult(count, _decrypted, _signature);
    decrypted = true;
    decryptedCount = _decrypted;
  }
  // [!endregion decrypt-for-tx-usage]
}
