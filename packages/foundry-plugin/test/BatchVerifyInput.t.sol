// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import { CofheTest } from '../contracts/CofheTest.sol';
import { CofheClient } from '../contracts/CofheClient.sol';
import { BatchedEncryptedInput } from '@fhenixprotocol/cofhe-contracts/ICofhe.sol';
import '@fhenixprotocol/cofhe-contracts/FHE.sol';

/// @dev Helper contract that verifies a batch of encrypted uint32 inputs sharing one signature.
contract BatchValueStore {
  euint32[] private _stored;

  function storeEuint32sBatch(externalEuint32[] memory hashes, bytes memory signature) public returns (euint32[] memory) {
    euint32[] memory values = FHE.asEuint32s(hashes, signature);
    for (uint256 i = 0; i < values.length; i++) {
      FHE.allowThis(values[i]);
      FHE.allowSender(values[i]);
      _stored.push(values[i]);
    }
    return values;
  }

  function stored(uint256 index) public view returns (euint32) {
    return _stored[index];
  }
}

/// @notice Exercises the new batch input verification path: one signature authenticating a
///         whole batch of ciphertexts, mirroring `FhenixProtocol/cofhe-contracts#78`'s own tests
///         (valid batch, wrong signer, tampered input, debug-mode bypass).
contract BatchVerifyInputTest is CofheTest {
  CofheClient cofheClient;
  BatchValueStore store;

  uint256 constant ALICE_PKEY = 0xA11CE;
  address alice;

  function setUp() public {
    deployMocks();
    cofheClient = createCofheClient();
    cofheClient.connect(ALICE_PKEY);
    alice = cofheClient.account();
    store = new BatchValueStore();
  }

  function testValidBatch_storesAllValuesInOrder() public {
    uint32[] memory values = new uint32[](3);
    values[0] = 10;
    values[1] = 20;
    values[2] = 30;

    (externalEuint32[] memory hashes, bytes memory signature) = cofheClient.createEuint32sBatch(values);
    vm.prank(alice);
    store.storeEuint32sBatch(hashes, signature);

    expectPlaintext(store.stored(0), values[0]);
    expectPlaintext(store.stored(1), values[1]);
    expectPlaintext(store.stored(2), values[2]);
  }

  function testWrongSigner_reverts() public {
    uint32[] memory values = new uint32[](2);
    values[0] = 1;
    values[1] = 2;

    (BatchedEncryptedInput[] memory inputs, ) = _computeBatch(values);

    // Sign the correct digest with the WRONG private key.
    bytes32 batchHash = _batchDigest(inputs, alice);
    (uint8 v, bytes32 r, bytes32 s) = vm.sign(0xBAD5163EA, batchHash);
    bytes memory wrongSignature = abi.encodePacked(r, s, v);

    externalEuint32[] memory hashes = new externalEuint32[](inputs.length);
    for (uint256 i = 0; i < inputs.length; i++) {
      hashes[i] = externalEuint32.wrap(bytes32(inputs[i].ctHash));
    }

    vm.expectRevert();
    vm.prank(alice);
    store.storeEuint32sBatch(hashes, wrongSignature);
  }

  function testTamperedInput_reverts() public {
    uint32[] memory values = new uint32[](2);
    values[0] = 5;
    values[1] = 6;

    (externalEuint32[] memory hashes, bytes memory signature) = cofheClient.createEuint32sBatch(values);

    // Swap the order of the hashes after signing - the batch digest no longer matches.
    (hashes[0], hashes[1]) = (hashes[1], hashes[0]);

    vm.expectRevert();
    vm.prank(alice);
    store.storeEuint32sBatch(hashes, signature);
  }

  function testDebugBypass_worksWithZeroSigner() public {
    vm.prank(TM_ADMIN);
    mockTaskManager.setVerifierSigner(address(0));

    uint32[] memory values = new uint32[](1);
    values[0] = 42;

    (externalEuint32[] memory hashes, ) = cofheClient.createEuint32sBatch(values);

    // No real signature required once the verifier signer is unset (debug mode).
    vm.prank(alice);
    store.storeEuint32sBatch(hashes, bytes(''));

    expectPlaintext(store.stored(0), values[0]);
  }

  /// @dev Mirrors CofheClient.createEncryptedInputsBatch, without signing, so wrong-signer tests
  ///      can compute the correct digest and sign it with an arbitrary (wrong) key.
  function _computeBatch(
    uint32[] memory values
  ) private returns (BatchedEncryptedInput[] memory inputs, externalEuint32[] memory hashes) {
    inputs = new BatchedEncryptedInput[](values.length);
    hashes = new externalEuint32[](values.length);
    for (uint256 i = 0; i < values.length; i++) {
      uint256 ctHash = mockZkVerifier.zkVerifyCalcCtHash(values[i], Utils.EUINT32_TFHE, alice, 0, block.chainid);
      mockZkVerifier.insertCtHash(ctHash, values[i]);
      inputs[i] = BatchedEncryptedInput({ ctHash: ctHash, securityZone: 0, utype: Utils.EUINT32_TFHE });
      hashes[i] = externalEuint32.wrap(bytes32(ctHash));
    }
  }

  function _batchDigest(BatchedEncryptedInput[] memory inputs, address sender) private view returns (bytes32) {
    bytes memory concatenatedHashes;
    for (uint256 i = 0; i < inputs.length; i++) {
      bytes memory combined = abi.encodePacked(
        inputs[i].ctHash,
        inputs[i].utype,
        inputs[i].securityZone,
        sender,
        block.chainid
      );
      concatenatedHashes = abi.encodePacked(concatenatedHashes, keccak256(combined));
    }
    return keccak256(concatenatedHashes);
  }
}
