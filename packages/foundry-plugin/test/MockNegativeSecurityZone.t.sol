// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import { CofheTest } from '../contracts/CofheTest.sol';
import { FHE, euint8 } from '@fhenixprotocol/cofhe-contracts/FHE.sol';

contract ZoneHandleOwner {
  euint8 public handle;

  function create(int32 securityZone) external {
    handle = FHE.randomEuint8(securityZone);
    FHE.allowThis(handle);
  }

  function share(address account) external {
    FHE.allow(handle, account);
  }
}

contract ZoneHandleUser {
  function add(euint8 value) external returns (euint8) {
    return FHE.add(value, value);
  }
}

/// @notice Handles in a negative security zone must go through the ACL like any other handle.
/// The TaskManager has no trivially-encrypted bypass, and the zone's sign bit is not a trivial flag.
contract MockNegativeSecurityZoneTest is CofheTest {
  ZoneHandleOwner owner;
  ZoneHandleUser user;

  function setUp() public {
    deployMocks();
    vm.prank(TM_ADMIN);
    mockTaskManager.setSecurityZones(-1, 1);

    owner = new ZoneHandleOwner();
    user = new ZoneHandleUser();
  }

  function testNegativeZoneHandleIsNotAllowedForOthers() public {
    owner.create(-1);
    euint8 handle = owner.handle();
    uint256 ctHash = uint256(euint8.unwrap(handle));

    assertTrue(mockTaskManager.isAllowed(ctHash, address(owner)));
    assertFalse(mockTaskManager.isAllowed(ctHash, address(user)));

    vm.expectRevert();
    user.add(handle);
  }

  function testAllowGrantsNegativeZoneHandle() public {
    owner.create(-1);
    euint8 handle = owner.handle();
    uint256 ctHash = uint256(euint8.unwrap(handle));

    owner.share(address(user));

    assertTrue(mockTaskManager.isAllowed(ctHash, address(user)));
    user.add(handle);
  }

  function testZeroZoneHandleIsNotAllowedForOthers() public {
    owner.create(0);
    euint8 handle = owner.handle();
    uint256 ctHash = uint256(euint8.unwrap(handle));

    assertFalse(mockTaskManager.isAllowed(ctHash, address(user)));
    vm.expectRevert();
    user.add(handle);
  }
}
