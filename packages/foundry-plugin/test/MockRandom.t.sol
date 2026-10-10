// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import { CofheTest } from '../contracts/CofheTest.sol';
import { FHE, euint8, euint32, euint64 } from '@fhenixprotocol/cofhe-contracts/FHE.sol';
import { InvalidSecurityZone } from '@cofhe/mock-contracts/contracts/MockTaskManager.sol';

/// @notice FHE.random* must return a handle the caller can use, like the real TaskManager does.
contract MockRandomTest is CofheTest {
  function setUp() public {
    deployMocks();
  }

  function randomEuint8InZone(int32 securityZone) external returns (euint8) {
    return FHE.randomEuint8(securityZone);
  }

  function testRandomHandleCarriesTypeAndZone() public {
    euint32 r = FHE.randomEuint32();
    uint256 h = uint256(euint32.unwrap(r));

    // Same metadata layout as every other handle: type in bits 8..14, security zone in the low byte.
    assertEq((h >> 8) & 0x7f, 4, 'utype');
    assertEq(h & 0xff, 0, 'security zone');
    assertTrue(mockTaskManager.inMockStorage(h), 'random value not in mock storage');
  }

  function testRandomHandleIsUsable() public {
    euint32 r = FHE.randomEuint32();

    // The caller holds the handle, so it can persist access and compute on it.
    FHE.allowThis(r);
    euint32 sum = FHE.add(r, FHE.asEuint32(1));

    unchecked {
      expectPlaintext(sum, getPlaintext(r) + 1);
    }
  }

  function testRandomValuesDifferWithinOneTransaction() public {
    euint64 a = FHE.randomEuint64();
    euint64 b = FHE.randomEuint64();

    assertTrue(euint64.unwrap(a) != euint64.unwrap(b), 'same handle');
    assertTrue(getPlaintext(a) != getPlaintext(b), 'same value');
  }

  function testRandomRejectsInvalidSecurityZone() public {
    // deployMocks() sets the zone range to [0, 1]
    vm.expectRevert(abi.encodeWithSelector(InvalidSecurityZone.selector, int32(2), int32(0), int32(1)));
    this.randomEuint8InZone(2);
  }
}
