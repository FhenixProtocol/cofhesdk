// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import { CofheTest } from '../contracts/CofheTest.sol';
import { FHE, euint8, euint16, euint32, euint64, euint128 } from '@fhenixprotocol/cofhe-contracts/FHE.sol';
import { InvalidInputForFunction, InvalidSecurityZone } from '@cofhe/mock-contracts/contracts/MockTaskManager.sol';

/// @notice FHE.asEuintN(uint256) must reject values that do not fit the type, like the real TaskManager does,
///         instead of silently truncating them.
contract MockTrivialEncryptTest is CofheTest {
  function setUp() public {
    deployMocks();
  }

  function asEuint8(uint256 value) external returns (euint8) {
    return FHE.asEuint8(value);
  }

  function asEuint16(uint256 value) external returns (euint16) {
    return FHE.asEuint16(value);
  }

  function asEuint32(uint256 value) external returns (euint32) {
    return FHE.asEuint32(value);
  }

  function asEuint64(uint256 value) external returns (euint64) {
    return FHE.asEuint64(value);
  }

  function asEuint128(uint256 value) external returns (euint128) {
    return FHE.asEuint128(value);
  }

  function asEuint8InZone(uint256 value, int32 securityZone) external returns (euint8) {
    return FHE.asEuint8(value, securityZone);
  }

  function _expectOutOfRange(uint8 utype) internal {
    vm.expectRevert(abi.encodeWithSelector(InvalidInputForFunction.selector, 'trivialEncrypt', utype));
  }

  function testMaxValuesStillEncrypt() public {
    expectPlaintext(this.asEuint8(type(uint8).max), type(uint8).max);
    expectPlaintext(this.asEuint16(type(uint16).max), type(uint16).max);
    expectPlaintext(this.asEuint32(type(uint32).max), type(uint32).max);
    expectPlaintext(this.asEuint64(type(uint64).max), type(uint64).max);
    expectPlaintext(this.asEuint128(type(uint128).max), type(uint128).max);
  }

  function testEuint8OutOfRangeReverts() public {
    _expectOutOfRange(2);
    this.asEuint8(uint256(type(uint8).max) + 1);
  }

  function testEuint16OutOfRangeReverts() public {
    _expectOutOfRange(3);
    this.asEuint16(uint256(type(uint16).max) + 1);
  }

  function testEuint32OutOfRangeReverts() public {
    _expectOutOfRange(4);
    this.asEuint32(uint256(type(uint32).max) + 1);
  }

  function testEuint64OutOfRangeReverts() public {
    _expectOutOfRange(5);
    this.asEuint64(uint256(type(uint64).max) + 1);
  }

  function testEuint128OutOfRangeReverts() public {
    _expectOutOfRange(6);
    this.asEuint128(uint256(type(uint128).max) + 1);
  }

  function testInvalidSecurityZoneReverts() public {
    // deployMocks() sets the zone range to [0, 1]
    vm.expectRevert(abi.encodeWithSelector(InvalidSecurityZone.selector, int32(2), int32(0), int32(1)));
    this.asEuint8InZone(1, 2);
  }
}
