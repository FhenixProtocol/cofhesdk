// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import { Test } from 'forge-std/Test.sol';
import { MockTaskManager } from '../contracts/MockTaskManager.sol';
import { Utils } from '@fhenixprotocol/cofhe-contracts/ICofhe.sol';

contract DecryptWithProofTest is Test {
  MockTaskManager private taskManager;

  uint256 private signerPrivateKey;
  address private signerAddress;

  function setUp() public {
    taskManager = new MockTaskManager();
    taskManager.initialize(address(this));

    signerPrivateKey = 0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef;
    signerAddress = vm.addr(signerPrivateKey);

    taskManager.setDecryptResultSigner(signerAddress);
  }

  function testPublishDecryptResult_happyPath() public {
    uint8 securityZone = 0;
    uint8 utype = Utils.EUINT32_TFHE;

    uint256 ctHash = _makeHandle(utype, securityZone);
    uint256 plaintextResult = 424242;

    bytes memory signature = _signDecryptResult(ctHash, plaintextResult, utype);

    taskManager.publishDecryptResult(ctHash, plaintextResult, signature);

    uint256 onchainResult = taskManager.getDecryptResult(ctHash);
    assertEq(onchainResult, plaintextResult);
  }

  // ----- helpers -----

  // TODO: use the same handle generation logic as other test. This is a temp one.
  function _makeHandle(uint8 utype, uint8 securityZone) private pure returns (uint256) {
    // ctHash format uses the lowest 16 bits for metadata.
    // We just need the type bits (byte 1) and securityZone (byte 0).
    uint256 base = uint256(keccak256('mock-ct-hash')) & ~uint256(0xFFFF);
    return base | (uint256(utype) << 8) | uint256(securityZone);
  }

  function _signDecryptResult(uint256 ctHash, uint256 result, uint8 utype) private view returns (bytes memory) {
    bytes32 digest = keccak256(abi.encodePacked(result, uint32(utype), uint64(block.chainid), bytes32(ctHash)));
    (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPrivateKey, digest);
    return abi.encodePacked(r, s, v);
  }
}
