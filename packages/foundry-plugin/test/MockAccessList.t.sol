// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import { CofheTest } from '../contracts/CofheTest.sol';
import { InvalidAddress } from '@cofhe/mock-contracts/contracts/MockTaskManager.sol';

/// @notice MockTaskManager implements the TaskManager's access list functions (cofhe-contracts 1.0.2).
contract MockAccessListTest is CofheTest {
  event AccessGranted(address indexed account);
  event AccessRevoked(address indexed account);

  address constant ALICE = address(0xA11CE);
  address constant BOB = address(0xB0B);

  function setUp() public {
    deployMocks();
  }

  function _accounts(address a, address b) internal pure returns (address[] memory accounts) {
    accounts = new address[](2);
    accounts[0] = a;
    accounts[1] = b;
  }

  function testAddToAccessList() public {
    vm.expectEmit(true, false, false, false, address(mockTaskManager));
    emit AccessGranted(ALICE);
    vm.expectEmit(true, false, false, false, address(mockTaskManager));
    emit AccessGranted(BOB);
    mockTaskManager.addToAccessList(_accounts(ALICE, BOB));

    assertTrue(mockTaskManager.accessList(ALICE));
    assertTrue(mockTaskManager.accessList(BOB));
  }

  function testRemoveFromAccessList() public {
    mockTaskManager.addToAccessList(_accounts(ALICE, BOB));

    address[] memory alice = new address[](1);
    alice[0] = ALICE;
    vm.expectEmit(true, false, false, false, address(mockTaskManager));
    emit AccessRevoked(ALICE);
    mockTaskManager.removeFromAccessList(alice);

    assertFalse(mockTaskManager.accessList(ALICE));
    assertTrue(mockTaskManager.accessList(BOB));
  }

  function testRejectsTheZeroAddress() public {
    vm.expectRevert(InvalidAddress.selector);
    mockTaskManager.addToAccessList(_accounts(ALICE, address(0)));

    vm.expectRevert(InvalidAddress.selector);
    mockTaskManager.removeFromAccessList(_accounts(address(0), BOB));
  }
}
