// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.25;

import { Test } from 'forge-std/Test.sol';
import '@fhenixprotocol/cofhe-contracts/FHE.sol';
import { CofheTest } from '../contracts/CofheTest.sol';

/// @dev Minimal consumer contract exercising a typical FHE flow.
contract GasConsumer {
  euint32 public counter;

  function init() public {
    counter = FHE.asEuint32(0);
    FHE.allowThis(counter);
  }

  function addToCounter(uint32 amount) public {
    counter = FHE.add(counter, FHE.asEuint32(amount));
    FHE.allowThis(counter);
  }

  function mixedOps(uint32 amount) public {
    euint32 a = FHE.asEuint32(amount);
    euint32 b = FHE.mul(a, FHE.asEuint32(2));
    ebool gt = FHE.gt(b, counter);
    counter = FHE.select(gt, b, counter);
    FHE.allowThis(counter);
  }
}

contract GasMeteringTest is CofheTest {
  GasConsumer consumer;

  function setUp() public {
    deployMocks();
    consumer = new GasConsumer();
    consumer.init();
  }

  function _measure(bool excluded) internal returns (uint256 gasAdd, uint256 gasMixed) {
    mockTaskManager.setMockGasExcluded(excluded);

    // Warm up so both variants hit warm storage slots equally
    consumer.addToCounter(1);
    consumer.mixedOps(1);

    uint256 g0 = gasleft();
    consumer.addToCounter(5);
    gasAdd = g0 - gasleft();

    g0 = gasleft();
    consumer.mixedOps(3);
    gasMixed = g0 - gasleft();
  }

  function test_gasComparison_metered() public {
    (uint256 gasAdd, uint256 gasMixed) = _measure(false);
    emit log_named_uint('metered   addToCounter', gasAdd);
    emit log_named_uint('metered   mixedOps    ', gasMixed);
  }

  function test_gasComparison_excluded() public {
    (uint256 gasAdd, uint256 gasMixed) = _measure(true);
    emit log_named_uint('excluded  addToCounter', gasAdd);
    emit log_named_uint('excluded  mixedOps    ', gasMixed);
  }

  /// @dev Correctness must be identical with the shim enabled.
  function test_resultsUnchangedWithExclusion() public {
    mockTaskManager.setMockGasExcluded(true);
    consumer.addToCounter(5);
    consumer.addToCounter(7);
    expectPlaintext(euint32.unwrap(consumer.counter()), 12);

    consumer.mixedOps(100); // 200 > 12 -> counter = 200
    expectPlaintext(euint32.unwrap(consumer.counter()), 200);
  }

  /// @dev Logging path also works while metering is paused.
  function test_worksWithLogsEnabled() public {
    mockTaskManager.setMockGasExcluded(true);
    enableLogs();
    consumer.addToCounter(3);
    expectPlaintext(euint32.unwrap(consumer.counter()), 3);
  }
}

/// @dev Triggers a genuine revert inside the mock replication: trivially-encrypted
///      hashes skip the ACL check in createTask, but have no plaintext in mock storage,
///      so MOCK_twoInputOperation reverts with InputNotInMockStorage while metering is paused.
contract GasMeteringRevertTest is CofheTest {
  GasConsumer consumer;

  function setUp() public {
    deployMocks();
    consumer = new GasConsumer();
    consumer.init();
  }

  function _fabricatedTrivialHash(bytes32 seed) internal pure returns (uint256) {
    // keccak-derived hash with metadata: [type|trivial bit] byte + securityZone byte
    return
      (uint256(keccak256(abi.encode(seed))) & ~uint256(0xFFFF)) |
      (uint256(0x80 | Utils.EUINT32_TFHE) << 8);
  }

  function test_meteringResumesAfterMockRevert() public {
    mockTaskManager.setMockGasExcluded(true);
    consumer.addToCounter(1); // warm up

    uint256[] memory hashes = new uint256[](2);
    hashes[0] = _fabricatedTrivialHash('a');
    hashes[1] = _fabricatedTrivialHash('b');
    uint256[] memory extra = new uint256[](0);

    vm.expectRevert();
    mockTaskManager.createTask(Utils.EUINT32_TFHE, FunctionId.add, hashes, extra);

    uint256 g0 = gasleft();
    consumer.addToCounter(5);
    uint256 gasAdd = g0 - gasleft();
    emit log_named_uint('post-revert addToCounter', gasAdd);
    // Same op measures ~100k when metering is healthy; near-zero means the paused state leaked
    assertGt(gasAdd, 50000, 'gas metering stayed paused after mock revert');
  }
}
