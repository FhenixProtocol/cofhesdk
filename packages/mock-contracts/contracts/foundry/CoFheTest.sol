// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import { Test } from 'forge-std/Test.sol';
import '@fhenixprotocol/cofhe-contracts/FHE.sol';
import { MockTaskManager } from '../MockTaskManager.sol';
import { MockACL } from '../MockACL.sol';
import { MockZkVerifier } from '../MockZkVerifier.sol';
import { MockZkVerifierSigner } from './MockZkVerifierSigner.sol';
import { MockThresholdNetwork } from '../MockThresholdNetwork.sol';
import { MockThresholdNetworkSigner } from './MockThresholdNetworkSigner.sol';
import { CofheClient } from './CofheClient.sol';
import { ZK_VERIFIER_SIGNER_ADDRESS, DECRYPT_RESULT_SIGNER_ADDRESS } from '../MockCoFHE.sol';

/// @notice Base contract for Foundry tests that use the CoFHE mock environment.
/// @dev    Inherit this contract and call `deployMocks()` in your `setUp()` function.
///         Use `createCofheClient()` to obtain a connected client instance.
abstract contract CofheTest is Test {
  MockTaskManager public mockTaskManager;
  MockACL public mockAcl;
  MockZkVerifier public mockZkVerifier;
  MockZkVerifierSigner public mockZkVerifierSigner;
  MockThresholdNetwork public mockThresholdNetwork;
  MockThresholdNetworkSigner public mockThresholdNetworkSigner;

  // Keep in sync with `packages/sdk/core/consts.ts`
  address constant ZK_VERIFIER_ADDRESS = 0x0000000000000000000000000000000000005001;
  address constant THRESHOLD_NETWORK_ADDRESS = 0x0000000000000000000000000000000000005002;

  address public constant TM_ADMIN = address(128);

  // =====================
  //     DEPLOY MOCKS
  // =====================

  /// @notice Deploys all mock contracts and wires them together, mirroring the Hardhat plugin's deployment order.
  function deployMocks() public {
    // 1. Task Manager
    deployCodeTo('MockTaskManager.sol:MockTaskManager', TASK_MANAGER_ADDRESS);
    mockTaskManager = MockTaskManager(TASK_MANAGER_ADDRESS);
    mockTaskManager.initialize(TM_ADMIN);
    vm.label(address(mockTaskManager), 'MockTaskManager');

    // 2. ACL (non-fixed deploy so constructor runs and EIP712 domain is set)
    mockAcl = new MockACL();
    vm.label(address(mockAcl), 'MockACL');

    // 3. Link Task Manager <-> ACL, configure signers
    vm.startPrank(TM_ADMIN);
    mockTaskManager.setACLContract(address(mockAcl));
    mockTaskManager.setSecurityZoneMin(0);
    mockTaskManager.setSecurityZoneMax(1);
    mockTaskManager.setVerifierSigner(ZK_VERIFIER_SIGNER_ADDRESS);
    mockTaskManager.setDecryptResultSigner(DECRYPT_RESULT_SIGNER_ADDRESS);
    vm.stopPrank();

    // 4. Fund ZK Verifier Signer
    vm.deal(ZK_VERIFIER_SIGNER_ADDRESS, 10 ether);

    // 5. ZK Verifier
    deployCodeTo('MockZkVerifier.sol:MockZkVerifier', ZK_VERIFIER_ADDRESS);
    mockZkVerifier = MockZkVerifier(ZK_VERIFIER_ADDRESS);
    vm.label(address(mockZkVerifier), 'MockZkVerifier');

    // 6. ZK Verifier Signer
    deployCodeTo('MockZkVerifierSigner.sol:MockZkVerifierSigner', ZK_VERIFIER_SIGNER_ADDRESS);
    mockZkVerifierSigner = MockZkVerifierSigner(ZK_VERIFIER_SIGNER_ADDRESS);
    vm.label(address(mockZkVerifierSigner), 'MockZkVerifierSigner');

    // 7. Threshold Network
    deployCodeTo('MockThresholdNetwork.sol:MockThresholdNetwork', THRESHOLD_NETWORK_ADDRESS);
    mockThresholdNetwork = MockThresholdNetwork(THRESHOLD_NETWORK_ADDRESS);
    mockThresholdNetwork.initialize(TASK_MANAGER_ADDRESS, address(mockAcl));
    vm.label(address(mockThresholdNetwork), 'MockThresholdNetwork');

    // 8. Threshold Network Signer
    deployCodeTo('MockThresholdNetworkSigner.sol:MockThresholdNetworkSigner', DECRYPT_RESULT_SIGNER_ADDRESS);
    mockThresholdNetworkSigner = MockThresholdNetworkSigner(DECRYPT_RESULT_SIGNER_ADDRESS);
    vm.label(address(mockThresholdNetworkSigner), 'MockThresholdNetworkSigner');
  }

  // =====================
  //    CREATE CLIENT
  // =====================

  /// @notice Deploys a new CofheClient instance. Call `connect(pkey)` on the result before use.
  function createCofheClient() public returns (CofheClient) {
    return new CofheClient();
  }

  // =====================
  //       LOGGING
  // =====================

  /// @notice Enables plaintext operation logging in the mock task manager.
  function enableLogs() public {
    mockTaskManager.setLogOps(true);
  }

  /// @notice Disables plaintext operation logging in the mock task manager.
  function disableLogs() public {
    mockTaskManager.setLogOps(false);
  }

  // =====================
  //    GET PLAINTEXT
  // =====================

  /// @notice Returns the stored plaintext for a ciphertext hash. Reverts if the hash is not in mock storage.
  function getPlaintext(bytes32 ctHash) public view returns (uint256) {
    uint256 ct = uint256(ctHash);
    require(mockTaskManager.inMockStorage(ct), 'CofheTest: plaintext does not exist');
    return mockTaskManager.mockStorage(ct);
  }

  /// @notice Returns the stored plaintext of an ebool. Reverts if the hash is not in mock storage.
  function getPlaintext(ebool eValue) internal view returns (bool) {
    return getPlaintext(ebool.unwrap(eValue)) != 0;
  }

  /// @notice Returns the stored plaintext of an euint8. Reverts if the hash is not in mock storage.
  function getPlaintext(euint8 eValue) internal view returns (uint8) {
    return uint8(getPlaintext(euint8.unwrap(eValue)));
  }

  /// @notice Returns the stored plaintext of an euint16. Reverts if the hash is not in mock storage.
  function getPlaintext(euint16 eValue) internal view returns (uint16) {
    return uint16(getPlaintext(euint16.unwrap(eValue)));
  }

  /// @notice Returns the stored plaintext of an euint32. Reverts if the hash is not in mock storage.
  function getPlaintext(euint32 eValue) internal view returns (uint32) {
    return uint32(getPlaintext(euint32.unwrap(eValue)));
  }

  /// @notice Returns the stored plaintext of an euint64. Reverts if the hash is not in mock storage.
  function getPlaintext(euint64 eValue) internal view returns (uint64) {
    return uint64(getPlaintext(euint64.unwrap(eValue)));
  }

  /// @notice Returns the stored plaintext of an euint128. Reverts if the hash is not in mock storage.
  function getPlaintext(euint128 eValue) internal view returns (uint128) {
    return uint128(getPlaintext(euint128.unwrap(eValue)));
  }

  /// @notice Returns the stored plaintext of an eaddress. Reverts if the hash is not in mock storage.
  function getPlaintext(eaddress eValue) internal view returns (address) {
    return address(uint160(getPlaintext(eaddress.unwrap(eValue))));
  }

  // =====================
  //   EXPECT PLAINTEXT
  // =====================

  /// @notice Asserts that a ctHash exists in mock storage and its plaintext matches the expected value.
  function expectPlaintext(bytes32 ctHash, uint256 value) public view {
    uint256 ct = uint256(ctHash);
    assertEq(mockTaskManager.inMockStorage(ct), true);
    assertEq(mockTaskManager.mockStorage(ct), value);
  }

  /// @notice Same as `expectPlaintext(bytes32, uint256)` but includes a failure message.
  function expectPlaintext(bytes32 ctHash, uint256 value, string memory message) public view {
    uint256 ct = uint256(ctHash);
    assertEq(mockTaskManager.inMockStorage(ct), true, message);
    assertEq(mockTaskManager.mockStorage(ct), value, message);
  }

  /// @notice Asserts that a ebool exists in mock storage and its plaintext matches the expected value.
  function expectPlaintext(ebool eValue, bool value) public view {
    expectPlaintext(ebool.unwrap(eValue), value ? 1 : 0);
  }

  /// @notice Asserts that a euint8 exists in mock storage and its plaintext matches the expected value.
  function expectPlaintext(euint8 eValue, uint8 value) public view {
    expectPlaintext(euint8.unwrap(eValue), uint256(value));
  }

  /// @notice Asserts that a euint16 exists in mock storage and its plaintext matches the expected value.
  function expectPlaintext(euint16 eValue, uint16 value) public view {
    expectPlaintext(euint16.unwrap(eValue), uint256(value));
  }

  /// @notice Asserts that a euint32 exists in mock storage and its plaintext matches the expected value.
  function expectPlaintext(euint32 eValue, uint32 value) public view {
    expectPlaintext(euint32.unwrap(eValue), uint256(value));
  }

  /// @notice Asserts that a euint64 exists in mock storage and its plaintext matches the expected value.
  function expectPlaintext(euint64 eValue, uint64 value) public view {
    expectPlaintext(euint64.unwrap(eValue), uint256(value));
  }

  /// @notice Asserts that a euint128 exists in mock storage and its plaintext matches the expected value.
  function expectPlaintext(euint128 eValue, uint128 value) public view {
    expectPlaintext(euint128.unwrap(eValue), uint256(value));
  }

  /// @notice Asserts that a eaddress exists in mock storage and its plaintext matches the expected value.
  function expectPlaintext(eaddress eValue, address value) public view {
    expectPlaintext(eaddress.unwrap(eValue), uint256(uint160(value)));
  }

  /// @notice Asserts that a ebool exists in mock storage and its plaintext matches the expected value, with a failure message.
  function expectPlaintext(ebool eValue, bool value, string memory message) public view {
    expectPlaintext(ebool.unwrap(eValue), value ? 1 : 0, message);
  }

  /// @notice Asserts that a euint8 exists in mock storage and its plaintext matches the expected value, with a failure message.
  function expectPlaintext(euint8 eValue, uint8 value, string memory message) public view {
    expectPlaintext(euint8.unwrap(eValue), uint256(value), message);
  }

  /// @notice Asserts that a euint16 exists in mock storage and its plaintext matches the expected value, with a failure message.
  function expectPlaintext(euint16 eValue, uint16 value, string memory message) public view {
    expectPlaintext(euint16.unwrap(eValue), uint256(value), message);
  }

  /// @notice Asserts that a euint32 exists in mock storage and its plaintext matches the expected value, with a failure message.
  function expectPlaintext(euint32 eValue, uint32 value, string memory message) public view {
    expectPlaintext(euint32.unwrap(eValue), uint256(value), message);
  }

  /// @notice Asserts that a euint64 exists in mock storage and its plaintext matches the expected value, with a failure message.
  function expectPlaintext(euint64 eValue, uint64 value, string memory message) public view {
    expectPlaintext(euint64.unwrap(eValue), uint256(value), message);
  }

  /// @notice Asserts that a euint128 exists in mock storage and its plaintext matches the expected value, with a failure message.
  function expectPlaintext(euint128 eValue, uint128 value, string memory message) public view {
    expectPlaintext(euint128.unwrap(eValue), uint256(value), message);
  }

  /// @notice Asserts that a eaddress exists in mock storage and its plaintext matches the expected value, with a failure message.
  function expectPlaintext(eaddress eValue, address value, string memory message) public view {
    expectPlaintext(eaddress.unwrap(eValue), uint256(uint160(value)), message);
  }
}
