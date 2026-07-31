// SPDX-License-Identifier: BSD-3-Clause-Clear
// solhint-disable one-contract-per-file

pragma solidity >=0.8.19 <0.9.0;

import { Test } from 'forge-std/Test.sol';
import { BatchedEncryptedInput } from '@fhenixprotocol/cofhe-contracts/ICofhe.sol';
import { ZK_VERIFIER_SIGNER_PRIVATE_KEY } from '@cofhe/mock-contracts/contracts/MockCoFHE.sol';

/**
 * @dev Generates valid signatures for encrypted inputs.
 * Uses vm.sign to generate the signatures (only available in foundry tests)
 * Should not need to be interacted with directly, is part of the `CofheClient.createIn*` function set
 */
contract MockZkVerifierSigner is Test {
  /// @notice The canonical batch signer: one signature over a whole batch of inputs, matching
  ///         `MockTaskManager.batchVerifyInputs`/`extractBatchSigner`'s digest -
  ///         keccak256(h_0 || h_1 || ... || h_n), where each h_i is the per-input message hash
  ///         (`ctHash || utype || securityZone || sender || chainid || contractAddress`).
  ///         `contractAddress` binds the batch to the specific contract that will consume it
  ///         (matching cofhe-contracts#77's contract-binding fix) - the caller must know in
  ///         advance which contract will call `FHE.asEuint*s` with the resulting hashes.
  function zkVerifyBatchSign(
    BatchedEncryptedInput[] memory inputs,
    address sender,
    address contractAddress
  ) public view returns (bytes memory signature) {
    bytes memory concatenatedHashes;
    for (uint256 i = 0; i < inputs.length; i++) {
      bytes memory combined = abi.encodePacked(
        inputs[i].ctHash,
        inputs[i].utype,
        inputs[i].securityZone,
        sender,
        block.chainid,
        contractAddress
      );
      concatenatedHashes = abi.encodePacked(concatenatedHashes, keccak256(combined));
    }

    bytes32 batchHash = keccak256(concatenatedHashes);

    (uint8 v, bytes32 r, bytes32 s) = vm.sign(ZK_VERIFIER_SIGNER_PRIVATE_KEY, batchHash);
    signature = abi.encodePacked(r, s, v);
  }
}
