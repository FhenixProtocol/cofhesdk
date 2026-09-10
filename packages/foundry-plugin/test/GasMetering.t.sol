// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.25;

import { Test, Vm } from 'forge-std/Test.sol';
import '@fhenixprotocol/cofhe-contracts/FHE.sol';
import { MockTaskManager } from '@cofhe/mock-contracts/contracts/MockTaskManager.sol';
import { CofheTest } from '../contracts/CofheTest.sol';

/// @dev Minimal consumer contract exercising a typical FHE flow.
contract GasConsumer {
  euint32 public counter;

  function init(uint32 start) public {
    counter = FHE.asEuint32(start);
    FHE.allowThis(counter);
  }

  function addToCounter(uint32 amount) public {
    counter = FHE.add(counter, FHE.asEuint32(amount));
    FHE.allowThis(counter);
  }

  function mixedOps(uint32 amount) public {
    euint32 a = FHE.asEuint32(amount);
    euint32 b = FHE.mul(a, FHE.asEuint32(amount + 1));
    ebool gt = FHE.gt(b, counter);
    counter = FHE.select(gt, b, counter);
    FHE.allowThis(counter);
  }

  function requestDecrypt() public {
    // createDecryptTask is a public task-manager entry point (not routed through the FHE
    // library in this version); called directly to exercise its mock-gas tracking.
    MockTaskManager(TASK_MANAGER_ADDRESS).createDecryptTask(uint256(euint32.unwrap(counter)), address(this));
  }
}

contract GasMeteringTest is CofheTest {
  bytes32 constant MOCK_GAS_CONSUMED_TOPIC = keccak256('MockGasConsumed(uint256)');

  function setUp() public {
    deployMocks();
  }

  /// @dev Deploys and warms up a consumer. Distinct `salt` values keep ctHashes (and thus
  ///      storage-slot temperature) independent between consumers within one test.
  function _newWarmConsumer(bool excluded, uint32 salt) internal returns (GasConsumer consumer) {
    mockTaskManager.setMockGasExcluded(excluded);
    consumer = new GasConsumer();
    consumer.init(salt);
    consumer.addToCounter(salt + 1); // warm up
    consumer.mixedOps(salt + 2);
  }

  /// @dev Measures one addToCounter + one mixedOps + one decrypt on a warmed consumer.
  function _measureFlows(
    GasConsumer consumer,
    uint32 salt
  ) internal returns (uint256 gasAdd, uint256 gasMixed, uint256 gasDecrypt) {
    uint256 g0 = gasleft();
    consumer.addToCounter(salt + 3);
    gasAdd = g0 - gasleft();

    g0 = gasleft();
    consumer.mixedOps(salt + 4);
    gasMixed = g0 - gasleft();

    g0 = gasleft();
    consumer.requestDecrypt();
    gasDecrypt = g0 - gasleft();
  }

  function _sumMockGasEvents(Vm.Log[] memory logs) internal view returns (uint256 total, uint256 count) {
    for (uint256 i = 0; i < logs.length; i++) {
      if (logs[i].emitter == address(mockTaskManager) && logs[i].topics[0] == MOCK_GAS_CONSUMED_TOPIC) {
        total += abi.decode(logs[i].data, (uint256));
        count++;
      }
    }
  }

  /// @dev The core promise of the exclusion feature: with it enabled, reported gas drops
  ///      substantially. Guards against silent degradation (e.g. allowCheatcodes removed
  ///      from deployMocks) - the shim is designed to fall back to metered execution
  ///      without reverting, so only an assertion like this catches it.
  function test_exclusionReducesReportedGas() public {
    GasConsumer a = _newWarmConsumer(true, 10);
    (uint256 exAdd, uint256 exMixed, uint256 exDecrypt) = _measureFlows(a, 10);
    GasConsumer b = _newWarmConsumer(false, 20);
    (uint256 mAdd, uint256 mMixed, uint256 mDecrypt) = _measureFlows(b, 20);

    emit log_named_uint('excluded  addToCounter', exAdd);
    emit log_named_uint('metered   addToCounter', mAdd);
    emit log_named_uint('excluded  mixedOps    ', exMixed);
    emit log_named_uint('metered   mixedOps    ', mMixed);
    emit log_named_uint('excluded  decrypt     ', exDecrypt);
    emit log_named_uint('metered   decrypt     ', mDecrypt);

    assertLt(exAdd, mAdd, 'exclusion should reduce addToCounter gas');
    assertGt(mAdd - exAdd, 50_000, 'addToCounter exclusion delta too small');
    assertLt(exMixed, mMixed, 'exclusion should reduce mixedOps gas');
    assertGt(mMixed - exMixed, 100_000, 'mixedOps exclusion delta too small');
    assertLt(exDecrypt, mDecrypt, 'exclusion should reduce decrypt gas');
    assertGt(mDecrypt - exDecrypt, 30_000, 'decrypt exclusion delta too small');
  }

  /// @dev Cross-checks the two mechanisms against each other: the forge-excluded gas and
  ///      the metered gas minus the sum of MockGasConsumed events must agree. If either
  ///      the pause bracketing or the measurement bracketing drifts (mock work added
  ///      outside a bracket, miscalibrated event cost), the two diverge and this fails.
  function _crossCheck(uint32 saltA, uint32 saltB) internal {
    GasConsumer a = _newWarmConsumer(true, saltA);
    (uint256 exAdd, uint256 exMixed, uint256 exDecrypt) = _measureFlows(a, saltA);
    uint256 excludedTotal = exAdd + exMixed + exDecrypt;

    GasConsumer b = _newWarmConsumer(false, saltB);
    vm.recordLogs();
    (uint256 mAdd, uint256 mMixed, uint256 mDecrypt) = _measureFlows(b, saltB);
    (uint256 mockGas, uint256 eventCount) = _sumMockGasEvents(vm.getRecordedLogs());
    uint256 adjustedTotal = mAdd + mMixed + mDecrypt - mockGas;

    emit log_named_uint('excluded total ', excludedTotal);
    emit log_named_uint('adjusted total ', adjustedTotal);
    emit log_named_uint('mock gas       ', mockGas);
    emit log_named_uint('mock events    ', eventCount);

    assertGt(eventCount, 0, 'expected MockGasConsumed events on the metered path');
    uint256 diff = adjustedTotal > excludedTotal ? adjustedTotal - excludedTotal : excludedTotal - adjustedTotal;
    // Small asymmetries are expected (cheatcode call overhead on the excluded path,
    // event-cost calibration), bounded per mock block.
    assertLt(diff, eventCount * 1_500, 'adjusted gas diverges from excluded gas');
  }

  function test_adjustedMatchesExcluded_logsOff() public {
    _crossCheck(30, 40);
  }

  function test_adjustedMatchesExcluded_logsOn() public {
    enableLogs();
    _crossCheck(50, 60);
  }

  /// @dev No MockGasConsumed events while gas metering is paused (forge exclusion active) -
  ///      emitting there would double-signal overhead that was never counted.
  function test_noEventsWhenExcluded() public {
    GasConsumer a = _newWarmConsumer(true, 70);
    vm.recordLogs();
    _measureFlows(a, 70);
    (, uint256 eventCount) = _sumMockGasEvents(vm.getRecordedLogs());
    assertEq(eventCount, 0, 'no MockGasConsumed events expected while metering is paused');
  }

  /// @dev Correctness must be identical with the shim enabled.
  function test_resultsUnchangedWithExclusion() public {
    mockTaskManager.setMockGasExcluded(true);
    GasConsumer consumer = new GasConsumer();
    consumer.init(0);
    consumer.addToCounter(5);
    consumer.addToCounter(7);
    expectPlaintext(euint32.unwrap(consumer.counter()), 12);

    consumer.mixedOps(99); // 99 * 100 > 12 -> counter = 9900
    expectPlaintext(euint32.unwrap(consumer.counter()), 9900);
  }

  /// @dev Logging path also works while metering is paused.
  function test_worksWithLogsEnabled() public {
    mockTaskManager.setMockGasExcluded(true);
    enableLogs();
    GasConsumer consumer = new GasConsumer();
    consumer.init(0);
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
    consumer.init(0);
  }

  function _fabricatedTrivialHash(bytes32 seed) internal pure returns (uint256) {
    // keccak-derived hash with metadata: [type|trivial bit] byte + securityZone byte
    return (uint256(keccak256(abi.encode(seed))) & ~uint256(0xFFFF)) | (uint256(0x80 | Utils.EUINT32_TFHE) << 8);
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

  /// @dev Same leak-check for createDecryptTask's tracked block: the plaintext read that can
  ///      revert (InputNotInMockStorage) happens before metering is paused.
  function test_meteringResumesAfterDecryptRevert() public {
    mockTaskManager.setMockGasExcluded(true);
    consumer.addToCounter(1); // warm up

    vm.expectRevert();
    mockTaskManager.createDecryptTask(_fabricatedTrivialHash('c'), address(this));

    uint256 g0 = gasleft();
    consumer.addToCounter(5);
    assertGt(g0 - gasleft(), 50000, 'gas metering stayed paused after decrypt revert');
  }
}
