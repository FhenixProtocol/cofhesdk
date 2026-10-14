// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import { CofheTest } from '../contracts/CofheTest.sol';
import { FHE, euint32 } from '@fhenixprotocol/cofhe-contracts/FHE.sol';

/// @notice MockTaskManager.isPubliclyAllowed must report the ACL's global allowance, like the TaskManager.
contract MockIsPubliclyAllowedTest is CofheTest {
  function setUp() public {
    deployMocks();
  }

  function testNotPubliclyAllowedByDefault() public {
    euint32 value = FHE.add(FHE.asEuint32(1), FHE.asEuint32(2));
    assertFalse(mockTaskManager.isPubliclyAllowed(uint256(euint32.unwrap(value))));
  }

  function testPubliclyAllowedAfterAllowGlobal() public {
    euint32 value = FHE.add(FHE.asEuint32(1), FHE.asEuint32(2));
    FHE.allowGlobal(value);
    assertTrue(mockTaskManager.isPubliclyAllowed(uint256(euint32.unwrap(value))));
  }

  function testAllowThisIsNotPublic() public {
    euint32 value = FHE.add(FHE.asEuint32(1), FHE.asEuint32(2));
    FHE.allowThis(value);
    assertFalse(mockTaskManager.isPubliclyAllowed(uint256(euint32.unwrap(value))));
  }
}
