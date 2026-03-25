// SPDX-License-Identifier: BSD-3-Clause-Clear

pragma solidity >=0.8.19 <0.9.0;

import { Test } from 'forge-std/Test.sol';
import { DECRYPT_RESULT_SIGNER_PRIVATE_KEY } from '@cofhe/mock-contracts/contracts/MockCoFHE.sol';

/**
 * @dev Generates valid signatures for decrypt results.
 * Uses vm.sign to generate the signatures (only available in foundry tests).
 * Mirrors the SDK's cofheMocksDecryptForTx.ts signing logic:
 *   keccak256(abi.encodePacked(ctHash, decryptedValue)) signed with DECRYPT_RESULT_SIGNER_PRIVATE_KEY
 */
contract MockThresholdNetworkSigner is Test {
  function signDecryptResult(
    uint256 ctHash,
    uint256 decryptedValue
  ) public pure returns (bytes memory signature) {
    bytes32 messageHash = keccak256(abi.encodePacked(ctHash, decryptedValue));

    (uint8 v, bytes32 r, bytes32 s) = vm.sign(DECRYPT_RESULT_SIGNER_PRIVATE_KEY, messageHash);
    signature = abi.encodePacked(r, s, v);
  }
}
