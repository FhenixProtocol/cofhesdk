// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import { CofheTest } from '../contracts/CofheTest.sol';
import { FHE, euint8 } from '@fhenixprotocol/cofhe-contracts/FHE.sol';
import {
  NotOnAccessList,
  OnlyAccessListManagerAllowed,
  InvalidAddress
} from '@cofhe/mock-contracts/contracts/MockTaskManager.sol';

/// @notice The mock task manager's access list behaves like the real one: off by default, and once
///         enabled only listed callers can create tasks. A contract the admin made a manager can
///         maintain the list through `FHE.addToAccessList` / `FHE.removeFromAccessList`.
contract MockAccessListTest is CofheTest {
  function setUp() public {
    deployMocks();
  }

  function asEuint8(uint256 value) external returns (euint8) {
    return FHE.asEuint8(value);
  }

  function listSelf() external {
    FHE.addToAccessList(_self());
  }

  function unlistSelf() external {
    FHE.removeFromAccessList(_self());
  }

  function _self() private view returns (address[] memory accounts) {
    accounts = new address[](1);
    accounts[0] = address(this);
  }

  function testAccessListOffByDefault() public {
    assertFalse(mockTaskManager.accessListEnabled());
    expectPlaintext(this.asEuint8(7), 7);
  }

  function testEnabledAccessListBlocksUnlistedCaller() public {
    vm.prank(TM_ADMIN);
    mockTaskManager.enableAccessList();

    vm.expectRevert(abi.encodeWithSelector(NotOnAccessList.selector, address(this)));
    this.asEuint8(7);

    vm.prank(TM_ADMIN);
    mockTaskManager.disableAccessList();
    expectPlaintext(this.asEuint8(7), 7);
  }

  function testListedCallerCreatesTasksUntilRemoved() public {
    vm.startPrank(TM_ADMIN);
    mockTaskManager.enableAccessList();
    mockTaskManager.addToAccessList(_self());
    vm.stopPrank();
    assertTrue(mockTaskManager.accessList(address(this)));
    expectPlaintext(this.asEuint8(7), 7);

    vm.prank(TM_ADMIN);
    mockTaskManager.removeFromAccessList(_self());
    assertFalse(mockTaskManager.accessList(address(this)));
    vm.expectRevert(abi.encodeWithSelector(NotOnAccessList.selector, address(this)));
    this.asEuint8(7);
  }

  function testManagerContractMaintainsListThroughFhe() public {
    vm.startPrank(TM_ADMIN);
    mockTaskManager.enableAccessList();
    mockTaskManager.MOCK_setAccessListManager(address(this), true);
    vm.stopPrank();

    this.listSelf();
    assertTrue(mockTaskManager.accessList(address(this)));
    expectPlaintext(this.asEuint8(7), 7);

    this.unlistSelf();
    assertFalse(mockTaskManager.accessList(address(this)));
  }

  function testOnlyManagersCanManage() public {
    address[] memory accounts = _self();

    vm.expectRevert(abi.encodeWithSelector(OnlyAccessListManagerAllowed.selector, address(this)));
    mockTaskManager.addToAccessList(accounts);
    vm.expectRevert(abi.encodeWithSelector(OnlyAccessListManagerAllowed.selector, address(this)));
    mockTaskManager.removeFromAccessList(accounts);
    vm.expectRevert(abi.encodeWithSelector(OnlyAccessListManagerAllowed.selector, address(this)));
    mockTaskManager.enableAccessList();
    vm.expectRevert(abi.encodeWithSelector(OnlyAccessListManagerAllowed.selector, address(this)));
    mockTaskManager.disableAccessList();
  }

  function testZeroAddressIsRejected() public {
    address[] memory accounts = new address[](1);
    vm.startPrank(TM_ADMIN);
    vm.expectRevert(InvalidAddress.selector);
    mockTaskManager.addToAccessList(accounts);
    vm.expectRevert(InvalidAddress.selector);
    mockTaskManager.removeFromAccessList(accounts);
    vm.stopPrank();
  }
}
