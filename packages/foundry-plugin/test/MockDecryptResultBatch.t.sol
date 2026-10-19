// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import { CofheTest } from '../contracts/CofheTest.sol';
import { FHE, euint32 } from '@fhenixprotocol/cofhe-contracts/FHE.sol';

/// @dev Publishes decrypt results through FHE.sol, as an application contract would.
contract DecryptResultPublisher {
  function publishBatch(euint32[] memory inputs, uint32[] memory results, bytes[] memory signatures) external {
    FHE.publishDecryptResultBatch(inputs, results, signatures);
  }
}

/// @notice The batch decrypt result functions must behave like the TaskManager's: published results are
///         attributed to the caller, and arrays of different lengths revert with `LengthMismatch`.
contract MockDecryptResultBatchTest is CofheTest {
  event DecryptionResult(uint256 ctHash, uint256 result, address indexed requestor);

  DecryptResultPublisher private publisher;
  euint32[] private inputs;
  uint32[] private results;
  bytes[] private signatures;

  function setUp() public {
    deployMocks();
    publisher = new DecryptResultPublisher();

    for (uint32 value = 5; value <= 7; value += 2) {
      euint32 input = FHE.asEuint32(value);
      inputs.push(input);
      results.push(value);
      signatures.push(mockThresholdNetworkSigner.signDecryptResult(uint256(euint32.unwrap(input)), value));
    }
  }

  function _ctHashes() internal view returns (uint256[] memory ctHashes) {
    ctHashes = new uint256[](inputs.length);
    for (uint256 i = 0; i < inputs.length; i++) {
      ctHashes[i] = uint256(euint32.unwrap(inputs[i]));
    }
  }

  function _results() internal view returns (uint256[] memory out) {
    out = new uint256[](results.length);
    for (uint256 i = 0; i < results.length; i++) {
      out[i] = results[i];
    }
  }

  function _expectLengthMismatch() internal {
    vm.expectRevert(abi.encodeWithSignature('LengthMismatch()'));
  }

  function testPublishDecryptResultBatchEmitsCallerAsRequestor() public {
    uint256[] memory ctHashes = _ctHashes();

    vm.expectEmit(address(mockTaskManager));
    emit DecryptionResult(ctHashes[0], results[0], address(publisher));
    vm.expectEmit(address(mockTaskManager));
    emit DecryptionResult(ctHashes[1], results[1], address(publisher));
    publisher.publishBatch(inputs, results, signatures);

    assertEq(mockTaskManager.getDecryptResult(ctHashes[0]), results[0]);
    assertEq(mockTaskManager.getDecryptResult(ctHashes[1]), results[1]);
  }

  function testPublishDecryptResultBatchRevertsOnExtraResult() public {
    results.push(9);

    _expectLengthMismatch();
    publisher.publishBatch(inputs, results, signatures);
  }

  function testPublishDecryptResultBatchRevertsOnMissingSignature() public {
    signatures.pop();

    _expectLengthMismatch();
    publisher.publishBatch(inputs, results, signatures);
  }

  function testVerifyDecryptResultBatchRevertsOnLengthMismatch() public {
    signatures.pop();

    _expectLengthMismatch();
    mockTaskManager.verifyDecryptResultBatch(_ctHashes(), _results(), signatures);
  }

  function testVerifyDecryptResultBatchSafeRevertsOnLengthMismatch() public {
    signatures.pop();

    _expectLengthMismatch();
    mockTaskManager.verifyDecryptResultBatchSafe(_ctHashes(), _results(), signatures);
  }

  function testVerifyDecryptResultBatchAcceptsMatchingArrays() public view {
    assertTrue(mockTaskManager.verifyDecryptResultBatch(_ctHashes(), _results(), signatures));

    bool[] memory valid = mockTaskManager.verifyDecryptResultBatchSafe(_ctHashes(), _results(), signatures);
    assertEq(valid.length, 2);
    assertTrue(valid[0]);
    assertTrue(valid[1]);
  }
}
