// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import { CofheTest } from '../contracts/CofheTest.sol';
import { FHE, euint8 } from '@fhenixprotocol/cofhe-contracts/FHE.sol';
import { InvalidSecurityZone } from '@cofhe/mock-contracts/contracts/MockTaskManager.sol';

/// @notice The security zone setters must reject an inverted range with the same error as the real
///         TaskManager, instead of storing a range that makes every later task revert.
contract MockSecurityZonesTest is CofheTest {
  function setUp() public {
    deployMocks();
  }

  function asEuint8InZone(uint256 value, int32 securityZone) external returns (euint8) {
    return FHE.asEuint8(value, securityZone);
  }

  function testSetSecurityZonesRejectsInvertedRange() public {
    vm.startPrank(TM_ADMIN);
    vm.expectRevert(abi.encodeWithSelector(InvalidSecurityZone.selector, int32(2), int32(2), int32(1)));
    mockTaskManager.setSecurityZones(2, 1);
    vm.stopPrank();

    // deployMocks() sets the zone range to [0, 1], and the rejected call leaves it unchanged
    expectPlaintext(this.asEuint8InZone(7, 1), 7);
  }

  function testSetSecurityZoneMaxBelowMinReverts() public {
    vm.startPrank(TM_ADMIN);
    vm.expectRevert(abi.encodeWithSelector(InvalidSecurityZone.selector, int32(0), int32(0), int32(-1)));
    mockTaskManager.setSecurityZoneMax(-1);
    vm.stopPrank();
  }

  function testSetSecurityZoneMinAboveMaxReverts() public {
    vm.startPrank(TM_ADMIN);
    vm.expectRevert(abi.encodeWithSelector(InvalidSecurityZone.selector, int32(2), int32(2), int32(1)));
    mockTaskManager.setSecurityZoneMin(2);
    vm.stopPrank();
  }

  function testSetSecurityZonesAcceptsSingleZoneRange() public {
    vm.prank(TM_ADMIN);
    mockTaskManager.setSecurityZones(1, 1);

    expectPlaintext(this.asEuint8InZone(7, 1), 7);

    vm.expectRevert(abi.encodeWithSelector(InvalidSecurityZone.selector, int32(0), int32(1), int32(1)));
    this.asEuint8InZone(7, 0);
  }
}
