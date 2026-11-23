// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import { Vm } from 'forge-std/Vm.sol';
import { CofheTest } from '../contracts/CofheTest.sol';
import { CofheClient } from '../contracts/CofheClient.sol';
import '@fhenixprotocol/cofhe-contracts/FHE.sol';
import { TMCommon } from '@cofhe/mock-contracts/contracts/MockTaskManager.sol';
import {
  ZK_VERIFIER_SIGNER_ADDRESS,
  DECRYPT_RESULT_SIGNER_ADDRESS
} from '@cofhe/mock-contracts/contracts/MockCoFHE.sol';

contract EventsValueStore {
  function store(externalEuint32[] memory hashes, bytes memory signature) public returns (euint32) {
    return FHE.asEuint32s(hashes, signature)[0];
  }

  function castToEuint64(uint32 value) public returns (euint64) {
    return FHE.asEuint64(FHE.asEuint32(value));
  }
}

/// @notice MockTaskManager emits the TaskManager's events, with the same arguments.
contract MockTaskManagerEventsTest is CofheTest {
  event TaskCreated(uint256 ctHash, string operation, uint256 input1, uint256 input2, uint256 input3);
  event InputVerified(uint256 indexed ctHash, bytes32 commitment);
  event DecryptResultSignerChanged(address indexed oldSigner, address indexed newSigner);
  event VerifierSignerChanged(address indexed oldSigner, address indexed newSigner);
  event ACLContractChanged(address indexed oldACL, address indexed newACL);
  event SecurityZonesChanged(int32 oldMin, int32 oldMax, int32 newMin, int32 newMax);

  CofheClient cofheClient;
  EventsValueStore valueStore;

  function setUp() public {
    deployMocks();
    cofheClient = createCofheClient();
    cofheClient.connect(0xA11CE);
    valueStore = new EventsValueStore();
  }

  function testBatchVerifyInputsEmitsInputVerified() public {
    (externalEuint32 hash, bytes memory signature) = cofheClient.createExternalEuint32(5, address(valueStore));
    externalEuint32[] memory hashes = new externalEuint32[](1);
    hashes[0] = hash;
    uint256 ctHash = uint256(externalEuint32.unwrap(hash));

    vm.expectEmit(address(mockTaskManager));
    emit InputVerified(TMCommon.appendMetadata(ctHash, 0, Utils.EUINT32_TFHE, false), bytes32(ctHash));
    vm.prank(cofheClient.account());
    valueStore.store(hashes, signature);
  }

  function testSetSecurityZonesEmitsSecurityZonesChanged() public {
    vm.expectEmit(address(mockTaskManager));
    emit SecurityZonesChanged(0, 1, -1, 2);
    vm.prank(TM_ADMIN);
    mockTaskManager.setSecurityZones(-1, 2);
  }

  function testSetSecurityZoneMinAndMaxEmitSecurityZonesChanged() public {
    vm.expectEmit(address(mockTaskManager));
    emit SecurityZonesChanged(0, 1, 0, 3);
    vm.prank(TM_ADMIN);
    mockTaskManager.setSecurityZoneMax(3);

    vm.expectEmit(address(mockTaskManager));
    emit SecurityZonesChanged(0, 3, -2, 3);
    vm.prank(TM_ADMIN);
    mockTaskManager.setSecurityZoneMin(-2);
  }

  function testSetVerifierSignerEmitsVerifierSignerChanged() public {
    vm.expectEmit(address(mockTaskManager));
    emit VerifierSignerChanged(ZK_VERIFIER_SIGNER_ADDRESS, address(0xBEEF));
    vm.prank(TM_ADMIN);
    mockTaskManager.setVerifierSigner(address(0xBEEF));
  }

  function testSetDecryptResultSignerEmitsDecryptResultSignerChanged() public {
    vm.expectEmit(address(mockTaskManager));
    emit DecryptResultSignerChanged(DECRYPT_RESULT_SIGNER_ADDRESS, address(0xBEEF));
    vm.prank(TM_ADMIN);
    mockTaskManager.setDecryptResultSigner(address(0xBEEF));
  }

  function testSetACLContractEmitsACLContractChanged() public {
    vm.expectEmit(address(mockTaskManager));
    emit ACLContractChanged(address(mockAcl), address(0xBEEF));
    vm.prank(TM_ADMIN);
    mockTaskManager.setACLContract(address(0xBEEF));
  }

  function testCastTaskCreatedCarriesTheTargetType() public {
    vm.recordLogs();
    valueStore.castToEuint64(7);

    Vm.Log[] memory logs = vm.getRecordedLogs();
    bool found;
    for (uint256 i = 0; i < logs.length; i++) {
      if (logs[i].emitter != address(mockTaskManager) || logs[i].topics[0] != TaskCreated.selector) continue;
      (, string memory operation, , uint256 input2, uint256 input3) = abi.decode(
        logs[i].data,
        (uint256, string, uint256, uint256, uint256)
      );
      if (keccak256(bytes(operation)) != keccak256('cast')) continue;
      assertEq(input2, Utils.EUINT64_TFHE);
      assertEq(input3, 0);
      found = true;
    }
    assertTrue(found, 'no cast TaskCreated event');
  }
}
